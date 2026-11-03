import "client-only";
import { bytesToBase64Url } from "@/lib/crypto/bytes";
import { parseLinkKey } from "@/lib/crypto/link";

const memory = new Map<string, string>();

function storageKey(token: string): string {
  return `aftervisit.helper-key.${token}`;
}

/** Keep a helper-link key for this tab. Session storage survives a reload. The map covers a blocked storage API. */
export function rememberHelperKey(token: string, hash: string): boolean {
  const bytes = parseLinkKey(hash);
  if (!bytes) return false;
  const encoded = bytesToBase64Url(bytes);
  memory.set(token, encoded);
  try {
    sessionStorage.setItem(storageKey(token), encoded);
  } catch {
    // The tab still holds the key in memory.
  }
  return true;
}

export function readHelperKey(token: string): string | null {
  const cached = memory.get(token);
  if (cached) return cached;
  try {
    const stored = sessionStorage.getItem(storageKey(token));
    if (stored) memory.set(token, stored);
    return stored;
  } catch {
    return null;
  }
}

/** Read #k= and remove it from the address bar. The server never received it. */
export function captureHelperKeyFromLocation(token: string): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  if (!hash.startsWith("#k=")) return;
  rememberHelperKey(token, hash);
  const next = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, "", next);
}
