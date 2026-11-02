import "client-only";

/** Raw circle-key bytes for a helper link. This file does not load the recovery wordlist. */
export async function exportKeyBytes(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
