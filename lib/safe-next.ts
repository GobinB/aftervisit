/** Where to send someone after Google sign-in. Anything off this site becomes /circles. */
export const SAFE_NEXT_FALLBACK = "/circles";

/**
 * Accepts only a same-origin path. Decodes once, rejects backslashes and control
 * characters, then checks the URL still lands on `origin`.
 */
export function safeNext(value: string | null | undefined, origin: string): string {
  if (!value) return SAFE_NEXT_FALLBACK;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return SAFE_NEXT_FALLBACK;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return SAFE_NEXT_FALLBACK;
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return SAFE_NEXT_FALLBACK;
  try {
    const url = new URL(decoded, origin);
    if (url.origin !== origin) return SAFE_NEXT_FALLBACK;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return SAFE_NEXT_FALLBACK;
  }
}
