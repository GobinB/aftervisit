/**
 * Which circle a scan belongs to, on /new. The circle is taken from the address straight away, then
 * looked up. Until the lookup answers, the visit cannot be read; if the circle cannot be opened, the
 * page says so instead of carrying on as a stand-alone handoff.
 */
export type ScanCircle =
  | { status: "checking" }
  | { status: "none" }
  | { status: "loading"; id: string }
  | { status: "ready"; id: string; personName: string }
  | { status: "failed"; id: string | null; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CIRCLE_NOT_OPENED = "This circle could not be opened, so the visit cannot be added to it. Go back and try again, or sign in again.";

/** From the address's query string: no circle, or a circle to look up. A malformed one fails at once. */
export function scanCircleFrom(search: string): ScanCircle {
  const id = new URLSearchParams(search).get("circle");
  if (id === null) return { status: "none" };
  if (!UUID.test(id)) return { status: "failed", id: null, message: CIRCLE_NOT_OPENED };
  return { status: "loading", id };
}

/** After the lookup answers. A lookup that throws counts as an answer: null. */
export function scanCircleAnswered(id: string, answer: { ok: true; personName: string } | { ok: false } | null): ScanCircle {
  if (answer?.ok) return { status: "ready", id, personName: answer.personName };
  return { status: "failed", id, message: CIRCLE_NOT_OPENED };
}

/** Done reads the summary only once it is known where the visit goes. */
export function canReadScan(circle: ScanCircle): boolean {
  return circle.status === "none" || circle.status === "ready";
}

/** The circle id a confirmed visit goes to; null only for a stand-alone handoff. */
export function scanCircleId(circle: ScanCircle): string | null {
  return circle.status === "ready" ? circle.id : null;
}

/** The circle the page is about, while it is looked up or once it is known; used for the way back. */
export function scanCircleHref(circle: ScanCircle): string | null {
  if (circle.status === "loading" || circle.status === "ready") return `/circles/${circle.id}`;
  if (circle.status === "failed" && circle.id) return `/circles/${circle.id}`;
  return null;
}
