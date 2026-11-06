/**
 * People's links, kept only in this browser so tapping a name can copy the link again.
 * The server keeps only a hash of each link, so it cannot show a link twice. Nothing here
 * leaves the device; a missing or blocked storage simply means the link is not remembered.
 */
export type SavedLink = { url: string; pin?: string; savedAt: string };

const key = (circleId: string) => `ahc.links.${circleId}`;

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

/** Keeps the newest link for a person. A PIN given earlier is kept when a new link replaces the old one. */
export function saveLink(circleId: string, memberId: string, url: string, pin?: string | null): void {
  try {
    const all = readAll(circleId);
    const keptPin = pin ?? all[memberId]?.pin;
    all[memberId] = { url, ...(keptPin ? { pin: keptPin } : {}), savedAt: new Date().toISOString() };
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
