import "client-only";

/**
 * Links made before November 14, 2026 carried a key after "#k=". Nothing uses it any more; it is
 * taken out of the address bar so it is not kept in the browser's history. The server never saw it.
 */
export function stripLinkHash(): void {
  if (typeof window === "undefined" || !window.location.hash) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
}
