import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const PREFIX = "v1";

export function fingerprintSecret(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) return "";
  return trimmed.slice(-4);
}

export function encryptSecret(masterKey: string, plaintext: string): string {
  const key = normalizeMasterKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(masterKey: string, packed: string): string {
  const [ver, ivB64, tagB64, ctB64] = packed.split(":");
  if (ver !== PREFIX || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Invalid vault ciphertext");
  }
  const key = normalizeMasterKey(masterKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeMasterKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("AI_VAULT_MASTER_KEY missing");
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(trimmed).digest();
}
