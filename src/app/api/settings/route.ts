import { z } from "zod";
import crypto from "node:crypto";
import { handle, ok, requireAdmin } from "@/lib/api";
import { getWabaConfig, updateWabaConfig } from "@/lib/settings";
import { maskSecret } from "@/lib/crypto";

function callbackUrl(): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/webhook`;
}

export const GET = handle(async () => {
  await requireAdmin();
  const cfg = await getWabaConfig();
  return ok({
    wabaId: cfg.wabaId ?? "",
    metaAppId: cfg.metaAppId ?? "",
    phoneNumberId: cfg.phoneNumberId ?? "",
    phoneNumberDisplay: cfg.phoneNumberDisplay ?? "",
    businessName: cfg.businessName ?? "",
    apiVersion: cfg.apiVersion,
    webhookVerifyToken: cfg.webhookVerifyToken ?? "",
    accessTokenSet: Boolean(cfg.accessToken),
    accessTokenMasked: maskSecret(cfg.accessToken),
    appSecretSet: Boolean(cfg.appSecret),
    callbackUrl: callbackUrl(),
    connected: Boolean(cfg.phoneNumberId && cfg.accessToken),
  });
});

const updateSchema = z.object({
  wabaId: z.string().trim().optional(),
  metaAppId: z.string().trim().optional(),
  phoneNumberId: z.string().trim().optional(),
  apiVersion: z.string().trim().optional(),
  webhookVerifyToken: z.string().trim().optional(),
  // Empty string clears; undefined leaves unchanged.
  accessToken: z.string().optional(),
  appSecret: z.string().optional(),
});

export const PUT = handle(async (req) => {
  await requireAdmin();
  const body = updateSchema.parse(await req.json());

  // Auto-generate a verify token if the user left it blank.
  let verifyToken = body.webhookVerifyToken;
  if (verifyToken !== undefined && verifyToken.trim() === "") {
    verifyToken = crypto.randomBytes(16).toString("hex");
  }

  await updateWabaConfig({
    wabaId: body.wabaId,
    metaAppId: body.metaAppId,
    phoneNumberId: body.phoneNumberId,
    apiVersion: body.apiVersion,
    webhookVerifyToken: verifyToken,
    // Only overwrite the token/secret when a non-empty value is supplied.
    accessToken: body.accessToken && body.accessToken.length > 0 ? body.accessToken : undefined,
    appSecret: body.appSecret && body.appSecret.length > 0 ? body.appSecret : undefined,
  });

  return ok({ saved: true });
});
