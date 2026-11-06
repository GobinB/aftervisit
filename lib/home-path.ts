/** The circle opened most recently on this device, set by middleware.ts. Only an id, never a name. */
export const LAST_CIRCLE_COOKIE = "ahc_last_circle";

/** A caregiver with one circle goes straight into it; with several, into the last one opened here. */
export function caregiverHome(circleIds: string[], lastCircle: string | undefined): string {
  if (lastCircle && circleIds.includes(lastCircle)) return `/circles/${lastCircle}`;
  if (circleIds.length === 1) return `/circles/${circleIds[0]}`;
  return "/circles";
}
