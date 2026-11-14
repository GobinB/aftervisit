import "client-only";

export { decryptFile, encryptFile, exportKeyBytes, generateFileKey, importCircleKey, normalizeWords, openWithWords, unwrapFileKey, WORDS_COUNT, wrapFileKey } from "@/lib/crypto/keys";
export type { FilePayload, StoredFileKey } from "@/lib/crypto/keys";
export { base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/bytes";
export { openPage, sealPage } from "@/lib/crypto/pages";
export { buildHelperLink, helperLinkForServer, parseLinkKey } from "@/lib/crypto/link";
export { captureHelperKeyFromLocation, readHelperKey, rememberHelperKey } from "@/lib/crypto/session";
export { clearCircleKeys, loadCircleKey, saveCircleKey } from "@/lib/crypto/idb";
export type { LocalCircleKey } from "@/lib/crypto/idb";
