import { prisma } from "@/lib/prisma";
import { getWabaConfig, type WabaConfig } from "@/lib/settings";

const GRAPH_HOST = "https://graph.facebook.com";

export class WhatsAppApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

export type GraphRequest = {
  method: "GET" | "POST" | "DELETE";
  /** Path after the API version, e.g. "/{phoneNumberId}/messages" or "/{wabaId}/message_templates". */
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** For linking the ApiLog row to a domain object. */
  related?: { type: string; id?: string };
  /** Provide a config to avoid a second DB read; otherwise loaded automatically. */
  config?: WabaConfig;
};

/**
 * Central Graph API caller. EVERY outbound WhatsApp Cloud API request goes
 * through here so it is automatically persisted to ApiLog (request + response).
 * The access token is never written to the log.
 */
export async function graphFetch<T = unknown>(req: GraphRequest): Promise<T> {
  const config = req.config ?? (await getWabaConfig());
  if (!config.accessToken) {
    throw new WhatsAppApiError(400, "WhatsApp is not connected. Set your access token in Settings.");
  }

  const version = config.apiVersion || "v21.0";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const query = qs.toString();
  const endpoint = `/${version}${req.path}${query ? `?${query}` : ""}`;
  const url = `${GRAPH_HOST}${endpoint}`;

  const started = Date.now();
  let responseStatus: number | null = null;
  let responseBody: unknown = null;
  let ok = false;

  try {
    const res = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        ...(req.body ? { "Content-Type": "application/json" } : {}),
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    responseStatus = res.status;
    const text = await res.text();
    responseBody = text ? safeJson(text) : null;
    ok = res.ok;

    if (!res.ok) {
      const err = (responseBody as { error?: { message?: string; code?: number; error_data?: unknown } })
        ?.error;
      throw new WhatsAppApiError(
        res.status,
        err?.message || `Graph API error (${res.status})`,
        err?.code,
        err?.error_data,
      );
    }
    return responseBody as T;
  } catch (e) {
    if (responseStatus === null) {
      // Network-level failure — record it too.
      responseBody = { error: e instanceof Error ? e.message : String(e) };
    }
    throw e;
  } finally {
    // Persist the audit log regardless of success/failure.
    await prisma.apiLog
      .create({
        data: {
          method: req.method,
          endpoint,
          requestBody: sanitizeBody(req.body),
          responseStatus: responseStatus ?? undefined,
          responseBody: responseBody as object | undefined,
          ok,
          durationMs: Date.now() - started,
          relatedType: req.related?.type,
          relatedId: req.related?.id,
        },
      })
      .catch((logErr) => console.error("Failed to write ApiLog:", logErr));
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/** Prisma Json can't store `undefined`; coerce to null. Also defensively drops any token field. */
function sanitizeBody(body: unknown): object | undefined {
  if (body === undefined || body === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(body)) as object;
  } catch {
    return undefined;
  }
}
