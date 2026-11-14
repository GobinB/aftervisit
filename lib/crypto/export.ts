import "client-only";

/** Raw circle-key bytes, for a helper link or to hand a key made with recovery words over to be kept. */
export async function exportKeyBytes(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
