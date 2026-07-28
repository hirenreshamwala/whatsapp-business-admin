import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (the WhatsApp access token).
 * ENCRYPTION_KEY must be 32 bytes as 64 hex chars.
 *
 * Format stored: base64( iv[12] || authTag[16] || ciphertext )
 */

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Mask a secret for display, e.g. "EAAB…9f2a". */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
