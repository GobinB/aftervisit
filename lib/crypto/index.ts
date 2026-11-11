import "client-only";

export { confirmationIndexes, generatePhrase, normalizePhrase, phraseEntropy, PHRASE_WORD_COUNT } from "@/lib/crypto/phrase";
export { decryptFile, encryptFile, exportKeyBytes, generateCircleKey, generateFileKey, importCircleKey, PBKDF2_ITERATIONS, rewrapFileKeys, unwrapCircleKey, unwrapFileKey, wrapCircleKey, wrapFileKey } from "@/lib/crypto/keys";
export type { FilePayload, StoredFileKey } from "@/lib/crypto/keys";
export { openPage, sealPage } from "@/lib/crypto/pages";
export { buildHelperLink, helperLinkForServer, parseLinkKey } from "@/lib/crypto/link";
export { captureHelperKeyFromLocation, readHelperKey, rememberHelperKey } from "@/lib/crypto/session";
export { clearCircleKeys, loadCircleKey, saveCircleKey } from "@/lib/crypto/idb";
export type { LocalCircleKey } from "@/lib/crypto/idb";
