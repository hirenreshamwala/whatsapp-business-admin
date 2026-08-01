import dns from "node:dns/promises";
import net from "node:net";
import https from "node:https";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

type Source = { literal?: unknown; source?: string };
export type RequestMapping = { path?: string; body?: Record<string, Source> };
export type ResponseMapping = { screen?: string; data?: string; error?: string };

function getPath(value: unknown, path?: string): unknown {
  if (!path || path === "$") return value;
  return path.replace(/^\$\.?/, "").split(".").filter(Boolean).reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const ip = address.toLowerCase();
  return ip === "::1" || ip === "::" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb") || ip.startsWith("::ffff:127.") || ip.startsWith("::ffff:10.") || ip.startsWith("::ffff:192.168.");
}

export async function assertSafeConnectorUrl(rawUrl: string, allowedHosts: string[]) {
  return (await resolveSafeConnectorUrl(rawUrl, allowedHosts)).url;
}

async function resolveSafeConnectorUrl(rawUrl: string, allowedHosts: string[]) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Flow connectors require HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in connector URLs.");
  if (!allowedHosts.map((host) => host.toLowerCase()).includes(url.hostname.toLowerCase())) throw new Error(`Host '${url.hostname}' is not approved for this connector.`);
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error("Connector host resolves to a blocked network address.");
  return { url, address: addresses[0].address, family: addresses[0].family };
}

export async function safePostJson(rawUrl: string, allowedHosts: string[], headers: Record<string, string>, body: string, timeoutMs: number) {
  const { url, address, family } = await resolveSafeConnectorUrl(rawUrl, allowedHosts);
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400) { response.resume(); reject(new Error("Connector redirects are not allowed.")); return; }
      const chunks: Buffer[] = [];
      let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 262_144) request.destroy(new Error("Connector response exceeds 256 KB."));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, text: Buffer.concat(chunks).toString("utf8") }));
    });
    request.setTimeout(Math.min(Math.max(timeoutMs, 500), 10_000), () => request.destroy(new Error("Connector request timed out.")));
    request.on("error", reject);
    request.end(body);
  });
}

export async function invokeFlowConnector(opts: {
  connectorId: string;
  launchId?: string;
  screen?: string;
  action: string;
  requestMapping: RequestMapping;
  responseMapping: ResponseMapping;
  context: Record<string, unknown>;
}) {
  const connector = await prisma.flowConnector.findUnique({ where: { id: opts.connectorId } });
  if (!connector?.active) throw new Error("Flow connector is unavailable.");
  const mappedBody: Record<string, unknown> = {};
  for (const [key, mapping] of Object.entries(opts.requestMapping.body || {})) {
    mappedBody[key] = Object.prototype.hasOwnProperty.call(mapping, "literal") ? mapping.literal : getPath(opts.context, mapping.source);
  }
  const url = new URL(opts.requestMapping.path || "", connector.baseUrl).toString();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (connector.authConfigEnc) {
    const auth = JSON.parse(decrypt(connector.authConfigEnc)) as { token?: string; username?: string; password?: string; name?: string; value?: string };
    if (connector.authType === "BEARER" && auth.token) headers.Authorization = `Bearer ${auth.token}`;
    if (connector.authType === "BASIC" && auth.username !== undefined) headers.Authorization = `Basic ${Buffer.from(`${auth.username}:${auth.password || ""}`).toString("base64")}`;
    if (connector.authType === "HEADER" && auth.name && auth.value) headers[auth.name] = auth.value;
  }
  const started = Date.now();
  let responseStatus: number | undefined;
  let invocationError: string | undefined;
  try {
    const response = await safePostJson(url, connector.allowedHosts, headers, JSON.stringify(mappedBody), connector.timeoutMs);
    responseStatus = response.status;
    if (response.status < 200 || response.status >= 300) throw new Error(`Connector returned HTTP ${response.status}.`);
    const text = response.text;
    const json = JSON.parse(text) as Record<string, unknown>;
    const screen = getPath(json, opts.responseMapping.screen || "$.screen");
    const data = getPath(json, opts.responseMapping.data || "$.data");
    const errorMsg = getPath(json, opts.responseMapping.error || "$.error_msg");
    if (screen !== undefined && typeof screen !== "string") throw new Error("Mapped connector screen must be a string.");
    if (data !== undefined && (!data || typeof data !== "object" || Array.isArray(data))) throw new Error("Mapped connector data must be an object.");
    return { ...(screen ? { screen } : {}), data: (data as Record<string, unknown>) || {}, ...(typeof errorMsg === "string" ? { error_msg: errorMsg } : {}) };
  } catch (error) {
    invocationError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await prisma.flowConnectorInvocation.create({
      data: {
        connectorId: connector.id,
        launchId: opts.launchId,
        screen: opts.screen,
        action: opts.action,
        responseStatus,
        ok: !invocationError,
        durationMs: Date.now() - started,
        error: invocationError,
      },
    }).catch(() => undefined);
  }
}
