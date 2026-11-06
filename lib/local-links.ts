/**
 * People's links, kept only in this browser so tapping a name can copy the link again.
 * The server keeps only a hash of each link, so it cannot show a link twice. Nothing here
 * leaves the device; a missing or blocked storage simply means the link is not remembered.
 * PINs are never kept, and every saved link is wiped when the caregiver signs out.
 */
export type SavedLink = { url: string; savedAt: string };

const PREFIX = "ahc.links.";

const key = (circleId: string) => `${PREFIX}${circleId}`;

function readAll(circleId: string): Record<string, SavedLink> {
  try {
    const raw = window.localStorage.getItem(key(circleId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, SavedLink>) : {};
  } catch {
    return {};
  }
}

export function loadLink(circleId: string, memberId: string): SavedLink | null {
  const saved = readAll(circleId)[memberId];
  return saved && typeof saved.url === "string" ? saved : null;
}

/** Keeps the newest link for a person. */
export function saveLink(circleId: string, memberId: string, url: string): void {
  try {
    const all = readAll(circleId);
    all[memberId] = { url, savedAt: new Date().toISOString() };
    window.localStorage.setItem(key(circleId), JSON.stringify(all));
  } catch {}
}

export function forgetLink(circleId: string, memberId: string): void {
  try {
    const all = readAll(circleId);
    delete all[memberId];
    window.localStorage.setItem(key(circleId), JSON.stringify(all));
  } catch {}
}

/** Removes every saved link on this device. Called on sign-out, so a shared computer keeps none. */
export function forgetAllLinks(): void {
  try {
    for (const name of Object.keys(window.localStorage)) if (name.startsWith(PREFIX)) window.localStorage.removeItem(name);
  } catch {}
}
