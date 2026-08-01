import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export type EncryptedFlowRequest = {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
};

export type DecryptedFlowRequest = {
  version: string;
  action: "ping" | "INIT" | "BACK" | "data_exchange" | string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
};

export class FlowEndpointError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function generateFlowKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const fingerprint = crypto.createHash("sha256").update(publicKey).digest("hex");
  return { publicKey, privateKey, fingerprint };
}

export async function createAndActivateFlowKey() {
  const pair = generateFlowKeyPair();
  const retireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.flowEncryptionKey.updateMany({ where: { active: true }, data: { active: false, retireAt } }),
    prisma.flowEncryptionKey.create({
      data: { fingerprint: pair.fingerprint, publicKeyPem: pair.publicKey, privateKeyEnc: encrypt(pair.privateKey), active: true },
    }),
  ]);
  return { fingerprint: pair.fingerprint, publicKey: pair.publicKey };
}

export async function getFlowKeyHealth() {
  const active = await prisma.flowEncryptionKey.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } });
  return active ? { configured: true, fingerprint: active.fingerprint, registeredAt: active.registeredAt } : { configured: false, fingerprint: null, registeredAt: null };
}

export async function decryptFlowRequest(body: EncryptedFlowRequest) {
  if (!body.encrypted_aes_key || !body.encrypted_flow_data || !body.initial_vector) {
    throw new FlowEndpointError(400, "Missing encrypted Flow request fields.");
  }
  const keys = await prisma.flowEncryptionKey.findMany({
    where: { OR: [{ active: true }, { retireAt: { gt: new Date() } }] },
    orderBy: { active: "desc" },
  });
  return decryptFlowRequestWithPrivateKeys(body, keys.map((keyRow) => decrypt(keyRow.privateKeyEnc)));
}

export function decryptFlowRequestWithPrivateKeys(body: EncryptedFlowRequest, privateKeys: string[]) {
  if (!body.encrypted_aes_key || !body.encrypted_flow_data || !body.initial_vector) {
    throw new FlowEndpointError(400, "Missing encrypted Flow request fields.");
  }
  for (const privatePem of privateKeys) {
    try {
      const privateKey = crypto.createPrivateKey(privatePem);
      const aesKey = crypto.privateDecrypt(
        { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(body.encrypted_aes_key, "base64"),
      );
      const encryptedData = Buffer.from(body.encrypted_flow_data, "base64");
      const iv = Buffer.from(body.initial_vector, "base64");
      if (encryptedData.length <= 16) throw new Error("Encrypted Flow data is too short.");
      const ciphertext = encryptedData.subarray(0, -16);
      const authTag = encryptedData.subarray(-16);
      const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      return { body: JSON.parse(plaintext) as DecryptedFlowRequest, aesKey, iv };
    } catch {
      // Try the previous key during rotation.
    }
  }
  throw new FlowEndpointError(421, "Unable to decrypt the Flow request. Refresh the registered public key.");
}

export function encryptFlowResponse(response: unknown, aesKey: Buffer, requestIv: Buffer): string {
  const flippedIv = Buffer.from(requestIv.map((byte) => ~byte));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}

export function flowTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newFlowToken(): string {
  return `wbf_${crypto.randomBytes(24).toString("base64url")}`;
}
