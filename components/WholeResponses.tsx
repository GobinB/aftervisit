"use client";

/**
 * Saves (server actions) and page refreshes are read in one piece, not as a stream.
 *
 * The React build inside Next.js 15.5 sometimes never applies a streamed save's answer: the save goes
 * through and the whole answer arrives, but the page is not redrawn, and a button waiting on it stays
 * on "Saving". It depends on the order the pieces arrive in, so it comes and goes (in a production
 * build in Chrome, about three times in four on Stop for a medicine; never when the answer is read whole).
 * These answers are small, so reading them whole before handing them on costs nothing anyone notices.
 *
 * Only requests that carry a save (the Next-Action header) or a refresh (the router's "refetch" marker)
 * are touched. Page navigations and prefetches stream as before. Remove this once Next.js is updated
 * past 15.5 and the browser tests still pass without it.
 */
export function isSaveOrRefresh(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("next-action")) return true;
  return headers.get("rsc") === "1" && !headers.has("next-router-prefetch") && (headers.get("next-router-state-tree") ?? "").includes("refetch");
}

if (typeof window !== "undefined" && !(window as { __wholeResponses?: boolean }).__wholeResponses) {
  (window as { __wholeResponses?: boolean }).__wholeResponses = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await original(input, init);
    if (!response.body || !isSaveOrRefresh(input, init)) return response;
    const body = await response.arrayBuffer();
    const whole = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    // Next reads these two from a refresh's answer; a new Response would otherwise lose them.
    Object.defineProperty(whole, "url", { value: response.url });
    Object.defineProperty(whole, "redirected", { value: response.redirected });
    return whole;
  };
}

export function WholeResponses() {
  return null;
}
