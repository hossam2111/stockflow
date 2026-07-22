import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.AI_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AI_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(secret).digest();
}

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return {
    encryptedApiKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    hint: apiKey.slice(-4),
  };
}

export function decryptApiKey(encryptedApiKey: string, iv: string, tag: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedApiKey, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function validateOpenAiKey(apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (response.ok) return { valid: true as const };
  if (response.status === 401) return { valid: false as const, reason: "INVALID_KEY" };
  if (response.status === 429) return { valid: false as const, reason: "RATE_LIMITED" };
  return { valid: false as const, reason: "OPENAI_UNAVAILABLE" };
}
