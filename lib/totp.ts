const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Returns true if, after uppercasing and removing spaces and '=' padding, the
 * string is non-empty and only contains base32 alphabet chars [A-Z2-7].
 */
export function isValidBase32Secret(secret: string): boolean {
  if (typeof secret !== "string") return false;
  const normalized = secret.toUpperCase().replace(/ /g, "").replace(/=/g, "");
  if (normalized.length === 0) return false;
  return /^[A-Z2-7]+$/.test(normalized);
}

/**
 * Base32-decode a secret into raw bytes per RFC 4648 (base32 alphabet).
 * Uppercases, strips spaces and '=' padding, maps each valid char to 5 bits,
 * accumulates into bytes, and ignores any char not in the alphabet.
 */
function base32Decode(secret: string): Uint8Array<ArrayBuffer> {
  const normalized = secret.toUpperCase().replace(/ /g, "").replace(/=/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue; // ignore any char not in the alphabet
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

/**
 * Generate a TOTP code per RFC 6238 using the Web Crypto API (crypto.subtle).
 * Runs in the browser. Throws Error("INVALID_SECRET") for invalid/empty input.
 */
export async function generateTotp(
  secret: string,
  periodSeconds = 30,
  digits = 6
): Promise<{ code: string; secondsRemaining: number }> {
  if (!isValidBase32Secret(secret)) {
    throw new Error("INVALID_SECRET");
  }

  const keyBytes = base32Decode(secret);

  const counter = Math.floor(Date.now() / 1000 / periodSeconds);
  const counterBytes = new Uint8Array(new ArrayBuffer(8));
  // Encode counter as 8-byte big-endian. Use a safe approach for values that
  // exceed 32 bits by splitting into high/low 32-bit halves.
  let high = Math.floor(counter / 0x100000000);
  let low = counter % 0x100000000;
  for (let i = 7; i >= 4; i--) {
    counterBytes[i] = low & 0xff;
    low = Math.floor(low / 256);
  }
  for (let i = 3; i >= 0; i--) {
    counterBytes[i] = high & 0xff;
    high = Math.floor(high / 256);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counterBytes)
  );

  // Dynamic truncation (RFC 6238 / RFC 4226).
  const offset = sig[19] & 0xf;
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);

  const code = (binary % 10 ** digits).toString().padStart(digits, "0");

  const secondsRemaining =
    periodSeconds - (Math.floor(Date.now() / 1000) % periodSeconds);

  return { code, secondsRemaining };
}
