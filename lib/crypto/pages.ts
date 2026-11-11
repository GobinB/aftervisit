import "client-only";
import { asBuffer } from "@/lib/crypto/bytes";

const IV_BYTES = 12;

/** Ties a sealed page to its summary and its place in it, so pages cannot be swapped or moved without failing to open. */
function pageLabel(documentId: string, page: number): ArrayBuffer {
  return asBuffer(new TextEncoder().encode(`ahc-page:${documentId}:${page}`));
}

/**
 * Encrypts one page (a photo or the PDF) with the summary's file key, AES-GCM.
 * The result is what is uploaded: a fresh 12-byte IV, then the ciphertext with its tag.
 */
export async function sealPage(plaintext: Uint8Array, fileKey: CryptoKey, documentId: string, page: number): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(iv), additionalData: pageLabel(documentId, page) }, fileKey, asBuffer(plaintext)),
  );
  const sealed = new Uint8Array(IV_BYTES + ciphertext.length);
  sealed.set(iv, 0);
  sealed.set(ciphertext, IV_BYTES);
  return sealed;
}

/** Opens a page sealed by sealPage. Throws when the key is wrong or the bytes were changed or moved. */
export async function openPage(sealed: Uint8Array, fileKey: CryptoKey, documentId: string, page: number): Promise<Uint8Array> {
  if (sealed.length <= IV_BYTES + 16) throw new Error("That page is not valid.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(sealed.subarray(0, IV_BYTES)), additionalData: pageLabel(documentId, page) },
    fileKey,
    asBuffer(sealed.subarray(IV_BYTES)),
  );
  return new Uint8Array(plain);
}
