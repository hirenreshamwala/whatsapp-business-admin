import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export type WabaConfig = {
  wabaId: string | null;
  metaAppId: string | null;
  phoneNumberId: string | null;
  phoneNumberDisplay: string | null;
  businessName: string | null;
  accessToken: string | null; // decrypted
  appSecret: string | null;
  webhookVerifyToken: string | null;
  apiVersion: string;
};

const SETTINGS_ID = "default";

/** Load settings with the access token decrypted. Server-side only. */
export async function getWabaConfig(): Promise<WabaConfig> {
  const row = await prisma.wabaSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    wabaId: row?.wabaId ?? null,
    metaAppId: row?.metaAppId ?? null,
    phoneNumberId: row?.phoneNumberId ?? null,
    phoneNumberDisplay: row?.phoneNumberDisplay ?? null,
    businessName: row?.businessName ?? null,
    accessToken: row?.accessTokenEnc ? decrypt(row.accessTokenEnc) : null,
    appSecret: row?.appSecret ?? null,
    webhookVerifyToken: row?.webhookVerifyToken ?? null,
    apiVersion: row?.apiVersion ?? process.env.GRAPH_API_VERSION ?? "v21.0",
  };
}

export type WabaUpdate = {
  wabaId?: string | null;
  metaAppId?: string | null;
  phoneNumberId?: string | null;
  phoneNumberDisplay?: string | null;
  businessName?: string | null;
  accessToken?: string | null; // plaintext in, encrypted at rest
  appSecret?: string | null;
  webhookVerifyToken?: string | null;
  apiVersion?: string;
};

export async function updateWabaConfig(update: WabaUpdate): Promise<void> {
  const data: Record<string, unknown> = {};
  if (update.wabaId !== undefined) data.wabaId = update.wabaId;
  if (update.metaAppId !== undefined) data.metaAppId = update.metaAppId;
  if (update.phoneNumberId !== undefined) data.phoneNumberId = update.phoneNumberId;
  if (update.phoneNumberDisplay !== undefined) data.phoneNumberDisplay = update.phoneNumberDisplay;
  if (update.businessName !== undefined) data.businessName = update.businessName;
  if (update.appSecret !== undefined) data.appSecret = update.appSecret;
  if (update.webhookVerifyToken !== undefined) data.webhookVerifyToken = update.webhookVerifyToken;
  if (update.apiVersion !== undefined) data.apiVersion = update.apiVersion;
  // Only re-encrypt when a non-empty token is provided (empty string = clear).
  if (update.accessToken !== undefined) {
    data.accessTokenEnc = update.accessToken ? encrypt(update.accessToken) : null;
  }

  await prisma.wabaSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}

export function isConfigured(cfg: WabaConfig): boolean {
  return Boolean(cfg.phoneNumberId && cfg.accessToken);
}
