import "client-only";
import { asBuffer, base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/bytes";
import { exportKeyBytes } from "@/lib/crypto/export";

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
