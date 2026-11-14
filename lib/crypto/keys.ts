import "client-only";
import { asBuffer, base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/bytes";
import { exportKeyBytes } from "@/lib/crypto/export";
import { WORDS_WRAPPED_KEY } from "@/lib/schema/circles";

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

export async function generateFileKey(): Promise<CryptoKey> {
  // Extractable so the circle key can wrap it. Decrypt later uses a non-extractable copy.
  return crypto.subtle.generateKey(AES, true, FILE_USES);
}

export { exportKeyBytes };

/** The circle key as the browser uses it. Extractable because helper links carry it after #. */
export async function importCircleKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("Circle key is not valid.");
  return crypto.subtle.importKey("raw", asBuffer(raw), AES, true, CIRCLE_USES);
}

/**
 * Circle keys used to be wrapped in the browser by 12 recovery words (PBKDF2-SHA256, 600,000
 * iterations, then AES-GCM). Nothing wraps a key that way any more. This opens one that still is,
 * for a caregiver who kept their words, so the key can be handed over and the words retired.
 */
export const WORDS_ITERATIONS = 600_000;
export const WORDS_COUNT = 12;

export function normalizeWords(words: string): string {
  return words.normalize("NFKD").trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

export async function openWithWords(packed: string, words: string): Promise<CryptoKey> {
  const match = WORDS_WRAPPED_KEY.exec(packed);
  if (!match) throw new Error("Wrapped key is not valid.");
  const normal = normalizeWords(words);
  if (normal.split(" ").length !== WORDS_COUNT) throw new Error("Enter all 12 words.");
  const salt = base64UrlToBytes(match[1] ?? "");
  const iv = base64UrlToBytes(match[2] ?? "");
  const wrapped = base64UrlToBytes(match[3] ?? "");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(normal), "PBKDF2", false, ["deriveKey"]);
  const wrapping = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: asBuffer(salt), iterations: WORDS_ITERATIONS, hash: "SHA-256" }, base, AES, false, ["unwrapKey"]);
  try {
    return await crypto.subtle.unwrapKey("raw", asBuffer(wrapped), wrapping, { name: "AES-GCM", iv: asBuffer(iv) }, AES, true, CIRCLE_USES);
  } catch {
    throw new Error("Those words did not open the saved summaries.");
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
