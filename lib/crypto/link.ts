import "client-only";
import { base64UrlToBytes, bytesToBase64Url } from "@/lib/crypto/bytes";

/** Same shape as a member token. Kept here so this file does not import server code. */
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

/**
 * The key is only in the hash. Browsers do not send the hash to the server.
 * `origin` is the caregiver's own address bar, not a value the server builds.
 */
export function buildHelperLink(origin: string, token: string, keyBytes: Uint8Array): string {
  if (!TOKEN_RE.test(token)) throw new Error("Link token is not valid.");
  if (keyBytes.length !== 32) throw new Error("Circle key is not valid.");
  const base = origin.replace(/\/$/, "");
  const fragment = bytesToBase64Url(keyBytes);
  return `${base}/i/${token}#k=${fragment}`;
}

/** The part of a helper link that may be sent to the server: origin, path, and token. Never the hash. */
export function helperLinkForServer(link: string): string {
  const url = new URL(link);
  url.hash = "";
  return url.toString();
}

export function parseLinkKey(hash: string): Uint8Array | null {
  const match = /^#k=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match?.[1]) return null;
  try {
    const bytes = base64UrlToBytes(match[1]);
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}
