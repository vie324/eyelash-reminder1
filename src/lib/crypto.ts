import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// AES-256-GCM による LINE channel access token / channel secret の暗号化。
//
// 鍵: LINE_TOKEN_ENC_KEY (base64-encoded 32 bytes)
//   生成: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// 出力フォーマット (base64):
//   version(1B) | iv(12B) | authTag(16B) | ciphertext(...)
//   先頭1バイトはバージョン番号。将来鍵ローテーションや別アルゴリズムへ移行する際に
//   復号側が分岐できるよう確保している。

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes (AES-256)
const IV_LENGTH = 12; // bytes (GCM推奨)
const AUTH_TAG_LENGTH = 16; // bytes
const VERSION_V1 = 1;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.LINE_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error("LINE_TOKEN_ENC_KEY is not set");
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error("LINE_TOKEN_ENC_KEY must be valid base64");
  }
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `LINE_TOKEN_ENC_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}`,
    );
  }
  cachedKey = key;
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const out = Buffer.concat([
    Buffer.from([VERSION_V1]),
    iv,
    authTag,
    ciphertext,
  ]);
  return out.toString("base64");
}

export function decryptSecret(encrypted: string): string {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  if (buf.length < 1 + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted payload is too short");
  }
  const version = buf[0];
  if (version !== VERSION_V1) {
    throw new Error(`Unsupported crypto version: ${version}`);
  }
  const iv = buf.subarray(1, 1 + IV_LENGTH);
  const authTag = buf.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// LINE webhook の x-line-signature 検証などで使う一定時間比較。
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
