import crypto from "node:crypto";

/** Verify Meta's X-Hub-Signature-256 header against the app secret. */
export function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
