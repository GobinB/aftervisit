import "client-only";
import { asBuffer, base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/bytes";
import { normalizePhrase, phraseEntropy } from "@/lib/crypto/phrase";
import { WRAPPED_CIRCLE_KEY } from "@/lib/schema/circles";

/**
 * PBKDF2-SHA256 at the OWASP 2023 minimum (600,000).
 * Web Crypto has PBKDF2. Argon2 and scrypt are not in the browser API.
 * av1 records that choice: salt, IV, and the wrapped key travel in one string.
 */
export const PBKDF2_ITERATIONS = 600_000;
export const WRAPPED_PREFIX = `av1.${PBKDF2_ITERATIONS}`;

const AES = { name: "AES-GCM", length: 256 } as const;
const CIRCLE_USES: KeyUsage[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
const FILE_USES: KeyUsage[] = ["encrypt", "decrypt"];

export type StoredFileKey = {
  fileKeyWrapped: string;
  fileKeyIv: string;
  keyVersion: number;
};

export type FilePayload = {
  ciphertext: Uint8Array;
  iv: Uint8Array;
};

export async function generateCircleKey(): Promise<CryptoKey> {
  // Extractable because helper links have to carry this key after #.
  return crypto.subtle.generateKey(AES, true, CIRCLE_USES);
}

export async function generateFileKey(): Promise<CryptoKey> {
  // Extractable so the circle key can wrap it. Decrypt later uses a non-extractable copy.
  return crypto.subtle.generateKey(AES, true, FILE_USES);
}

export async function exportKeyBytes(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function importCircleKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("Circle key is not valid.");
  return crypto.subtle.importKey("raw", asBuffer(raw), AES, true, CIRCLE_USES);
}

async function deriveWrappingKey(phrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const entropy = await phraseEntropy(phrase);
  if (!entropy) throw new Error("Those words are not a recovery phrase.");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalizePhrase(phrase)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    AES,
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/** The phrase and the raw key never leave the browser. The return value is what the server may store. */
export async function wrapCircleKey(circleKey: CryptoKey, phrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapping = await deriveWrappingKey(phrase, salt);
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey("raw", circleKey, wrapping, { name: "AES-GCM", iv: asBuffer(iv) }));
  const packed = `${WRAPPED_PREFIX}.${bytesToBase64Url(salt)}.${bytesToBase64Url(iv)}.${bytesToBase64Url(wrapped)}`;
  if (!WRAPPED_CIRCLE_KEY.test(packed)) throw new Error("Wrapped key is not valid.");
  return packed;
}

export async function unwrapCircleKey(packed: string, phrase: string): Promise<CryptoKey> {
  const match = WRAPPED_CIRCLE_KEY.exec(packed);
  if (!match) throw new Error("Wrapped key is not valid.");
  const salt = base64UrlToBytes(match[1] ?? "");
  const iv = base64UrlToBytes(match[2] ?? "");
  const wrapped = base64UrlToBytes(match[3] ?? "");
  const wrapping = await deriveWrappingKey(phrase, salt);
  try {
    return await crypto.subtle.unwrapKey("raw", asBuffer(wrapped), wrapping, { name: "AES-GCM", iv: asBuffer(iv) }, AES, true, CIRCLE_USES);
  } catch {
    throw new Error("Those words did not open the key.");
  }
}

export async function wrapFileKey(fileKey: CryptoKey, circleKey: CryptoKey, keyVersion: number): Promise<StoredFileKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey("raw", fileKey, circleKey, { name: "AES-GCM", iv: asBuffer(iv) }));
  return { fileKeyWrapped: bytesToBase64Url(wrapped), fileKeyIv: bytesToBase64Url(iv), keyVersion };
}

export async function unwrapFileKey(stored: StoredFileKey, circleKey: CryptoKey, extractable = false): Promise<CryptoKey> {
  const iv = base64UrlToBytes(stored.fileKeyIv);
  const wrapped = base64UrlToBytes(stored.fileKeyWrapped);
  if (iv.length !== 12) throw new Error("File key is not valid.");
  return crypto.subtle.unwrapKey("raw", asBuffer(wrapped), circleKey, { name: "AES-GCM", iv: asBuffer(iv) }, AES, extractable, FILE_USES);
}

export async function encryptFile(plaintext: Uint8Array, fileKey: CryptoKey): Promise<FilePayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, fileKey, asBuffer(plaintext)));
  return { ciphertext, iv };
}

export async function decryptFile(ciphertext: Uint8Array, iv: Uint8Array, fileKey: CryptoKey): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBuffer(iv) }, fileKey, asBuffer(ciphertext));
  return new Uint8Array(plain);
}

/**
 * Rewrap each file key from the previous circle key to the next one.
 * TODO: write the results onto file rows once that table exists. The app does not call this yet.
 */
export async function rewrapFileKeys(
  files: readonly StoredFileKey[],
  previousCircleKey: CryptoKey,
  nextCircleKey: CryptoKey,
  nextKeyVersion: number,
): Promise<StoredFileKey[]> {
  const next: StoredFileKey[] = [];
  for (const file of files) {
    const key = await unwrapFileKey(file, previousCircleKey, true);
    next.push(await wrapFileKey(key, nextCircleKey, nextKeyVersion));
  }
  return next;
}
