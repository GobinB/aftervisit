/**
 * The welcome a person sees the first time they open their link ("Lena added you to Teodora's
 * circle..."), until they tap Got it. Which people on this device have tapped it is kept in a cookie
 * of member ids: ids only, never a name. A new phone shows it once more.
 */
export const WELCOMED_COOKIE = "ahc_welcomed";
const KEEP = 20;
const ID = /^[0-9a-f-]{36}$/i;

export function readWelcomed(value: string | undefined): string[] {
  return (value ?? "").split(".").filter((id) => ID.test(id));
}

/** Adds one person, keeping the newest few so the cookie stays small. */
export function addWelcomed(value: string | undefined, memberId: string): string {
  const ids = readWelcomed(value).filter((id) => id !== memberId);
  return [...ids, memberId].slice(-KEEP).join(".");
}
