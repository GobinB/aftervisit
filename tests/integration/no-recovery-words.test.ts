import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import type { LocalCircleKey } from "@/lib/crypto/idb";
import { emptyState, fakeClient, type FakeState } from "../helpers/fake-circle-db";

/**
 * The whole path a caregiver's saved photos take, with the real browser crypto, the real server
 * actions and services, and the real server key wrap. Only the edges are stand-ins: sign-in
 * (getActor), the database and file storage (tests/helpers/fake-circle-db.ts), and this device's
 * IndexedDB. Signed-in screens cannot be opened in Playwright here, so this is where "sign out,
 * sign in, open a saved summary with no prompt" is checked.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

let state: FakeState = emptyState();
const clientFor = vi.fn((actor: Actor) => fakeClient(state, actor.kind === "caregiver" ? actor.userId : null));
vi.mock("@/store/db", () => ({ clientFor: (actor: Actor) => clientFor(actor), serviceClient: () => fakeClient(state, null) }));

let signedIn: Actor | null = null;
vi.mock("@/lib/auth", () => ({ getActor: async () => signedIn }));

const env = { circleKeySecret: "test-secret-for-circle-keys-0123456789-abcdefghijklmnop" };
vi.mock("@/lib/env", () => ({ env, RATE_LIMITS: { circleKey: 120 } }));

const underLimit = vi.fn<(userId: string, bucket: string, limit: number) => Promise<boolean>>();
vi.mock("@/lib/ratelimit", () => ({ checkActorRateLimit: (userId: string, bucket: string, limit: number) => underLimit(userId, bucket, limit) }));

/** One phone or computer's saved keys. A new Map is a new device, or the same one after signing out. */
let device = new Map<string, LocalCircleKey>();
vi.mock("@/lib/crypto/idb", () => ({
  loadCircleKey: async (circleId: string) => device.get(circleId) ?? null,
  saveCircleKey: async (circleId: string, key: CryptoKey, keyVersion: number) => void device.set(circleId, { circleId, key, keyVersion }),
  clearCircleKeys: async () => device.clear(),
}));

const { ensureCircleKey, openOldKeyWithWords, startFresh } = await import("@/components/circles/circle-key");
const { urlForMemberToken } = await import("@/components/circles/member-link");
const { handOverCircleKeyAction, openCircleKeyAction, startFreshCircleKeyAction } = await import("@/app/actions/circle-keys");
const { createDocumentAction } = await import("@/app/actions/documents");
const { addPage, readPage } = await import("@/services/documents");
const { getCircleKeyState } = await import("@/services/circle-keys");
const { clearCircleKeys } = await import("@/lib/crypto/idb");
const { generateFileKey, importCircleKey, unwrapFileKey, wrapFileKey } = await import("@/lib/crypto/keys");
const { exportKeyBytes } = await import("@/lib/crypto/export");
const { bytesToBase64Url } = await import("@/lib/crypto/bytes");
const { openPage, sealPage } = await import("@/lib/crypto/pages");
const { parseLinkKey } = await import("@/lib/crypto/link");
const { openCircleKey: openStored, sealCircleKey } = await import("@/lib/key-custody");
const { fileKind } = await import("@/lib/schema/documents");

const CIRCLE = "22222222-2222-4222-8222-222222222222";
const OTHER_CIRCLE = "44444444-4444-4444-8444-444444444444";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [CIRCLE], role: "owner", accessToken: "token" };
/** Another caregiver, signed in with Google, with a circle of their own. */
const other: Actor = { kind: "caregiver", userId: "user-other", circleIds: [OTHER_CIRCLE], role: "owner", accessToken: "token" };
const family: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId: CIRCLE, role: "family", visibility: {} };

/** A fictional page: JPEG's first bytes, then text that must never be stored as written. */
const MARKER = "Maplewood Family Clinic metformin 500 mg";
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(MARKER.repeat(20))]);

/** The key bytes 1..32 wrapped the old way by these words: a fixed sample of what circles made before this change hold. */
const WORDS = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const WORDS_WRAPPED = "av1.600000.BwcHBwcHBwcHBwcHBwcHBw.CQkJCQkJCQkJCQkJ.HjJDlfueDE80z1civaCUlcv2-xAJhJ3UwUMvgeL9stWx0Brhvb0uniVV013hsgWZ";
const OLD_KEY = new Uint8Array(32).map((_, index) => index + 1);

function newCircle(wrapped: string | null = null) {
  state.circles.push({ id: CIRCLE, key_version: 1, deleted_at: null }, { id: OTHER_CIRCLE, key_version: 1, deleted_at: null });
  state.circle_caregivers.push(
    { circle_id: CIRCLE, user_id: "user-owner", role: "owner", circle_key_wrapped: wrapped, key_version: 1 },
    { circle_id: OTHER_CIRCLE, user_id: "user-other", role: "owner", circle_key_wrapped: null, key_version: 1 },
  );
}

const stored = () => state.circle_caregivers.find((row) => row.circle_id === CIRCLE)!;
const known = () => getCircleKeyState(signedIn!, CIRCLE);
const contains = (haystack: Uint8Array, needle: string) => Buffer.from(haystack).includes(Buffer.from(needle));

/** Keeps one page of a visit summary, as the visit screen does: file key, wrapped by the circle key, page encrypted here. */
async function keepPhoto(circleKey: CryptoKey, keyVersion: number): Promise<string> {
  const fileKey = await generateFileKey();
  const created = await createDocumentAction({ ...(await wrapFileKey(fileKey, circleKey, keyVersion)), circleId: CIRCLE, kind: "photos", pageCount: 1 });
  if (!created.ok) throw new Error(created.error);
  const sent = await addPage(signedIn!, CIRCLE, created.id, 1, await sealPage(PHOTO, fileKey, created.id, 1));
  if (!sent.ok) throw new Error(sent.error);
  return created.id;
}

/** Opens a saved summary's page, as the saved-summary screen does. */
async function openPhoto(documentId: string, circleKey: CryptoKey): Promise<Uint8Array> {
  const row = state.visit_documents.find((item) => item.id === documentId)!;
  const page = await readPage(signedIn!, CIRCLE, documentId, 1);
  if (!page) throw new Error("page not found");
  const fileKey = await unwrapFileKey({ fileKeyWrapped: row.file_key_wrapped!, fileKeyIv: row.file_key_iv!, keyVersion: row.key_version! }, circleKey);
  return openPage(new Uint8Array(page.bytes), fileKey, documentId, 1);
}

/** A circle from before this change: a key made with words, and one summary saved with it. */
async function circleWithWords(): Promise<string> {
  newCircle(WORDS_WRAPPED);
  signedIn = owner;
  return keepPhoto(await importCircleKey(OLD_KEY), 1);
}

beforeEach(() => {
  state = emptyState();
  device = new Map();
  signedIn = null;
  clientFor.mockClear();
  underLimit.mockReset();
  underLimit.mockResolvedValue(true);
  vi.stubGlobal("window", { location: { origin: "https://allhandscare.example" } });
});

describe("no recovery words", () => {
  test("sign out, sign in on a new device, open a saved summary: no prompt", async () => {
    newCircle();
    signedIn = owner;

    // First device. Keeping photos is the first time the circle needs a key, so it gets one by itself.
    const first = await ensureCircleKey(CIRCLE, await known());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const documentId = await keepPhoto(first.key, first.keyVersion);

    // What reached storage and the database is ciphertext and wrapped keys.
    const kept = state.storage.get(`${CIRCLE}/${documentId}/1.enc`)!;
    expect(fileKind(kept)).toBeNull();
    expect(contains(kept, "Maplewood")).toBe(false);
    expect(stored().circle_key_wrapped).toMatch(/^av2\./);
    expect(JSON.stringify([state.circle_caregivers, state.visit_documents])).not.toContain(bytesToBase64Url(await exportKeyBytes(first.key)));

    // Sign out: this device's keys are cleared.
    await clearCircleKeys();
    signedIn = null;
    expect((await openCircleKeyAction(CIRCLE)).ok).toBe(false);

    // Sign in again on a phone that has never seen this circle.
    device = new Map();
    signedIn = owner;
    const again = await ensureCircleKey(CIRCLE, await known());
    expect(again).toMatchObject({ ok: true, keyVersion: 1 });
    if (!again.ok) return;
    expect(await openPhoto(documentId, again.key)).toEqual(PHOTO);
  });

  test("a key kept on this device is used without asking the server again, and only while it is the held one", async () => {
    newCircle();
    signedIn = owner;
    await ensureCircleKey(CIRCLE, await known());
    underLimit.mockClear();
    const again = await ensureCircleKey(CIRCLE, await known());
    expect(again.ok).toBe(true);
    expect(underLimit).not.toHaveBeenCalled();

    // A copy left from an earlier key version is never used.
    device.set(CIRCLE, { circleId: CIRCLE, key: await importCircleKey(OLD_KEY), keyVersion: 7 });
    const fresh = await ensureCircleKey(CIRCLE, await known());
    expect(fresh.ok && bytesToBase64Url(await exportKeyBytes(fresh.key))).toBe(bytesToBase64Url(openStored(stored().circle_key_wrapped!, CIRCLE, 1)));
  });

  test("two devices asking at once for a circle's first key end with the same key", async () => {
    newCircle();
    signedIn = owner;
    const [a, b] = await Promise.all([openCircleKeyAction(CIRCLE), openCircleKeyAction(CIRCLE)]);
    expect(a.ok && b.ok && a.state === "ready" && b.state === "ready" && a.key === b.key).toBe(true);
  });

  test("making a person's link gives the circle its key, and the link carries it after #", async () => {
    newCircle();
    signedIn = owner;
    const built = await urlForMemberToken(CIRCLE, "abcdefghijklmnopqrstuvwx", await known());
    expect(built.withKey).toBe(true);
    const url = new URL(built.url);
    expect(url.pathname).toBe("/i/abcdefghijklmnopqrstuvwx");
    expect(parseLinkKey(url.hash)).toEqual(openStored(stored().circle_key_wrapped!, CIRCLE, 1));
  });

  test("when the key cannot be had, a person's link is still made, without it", async () => {
    newCircle();
    signedIn = owner;
    env.circleKeySecret = "";
    const built = await urlForMemberToken(CIRCLE, "abcdefghijklmnopqrstuvwx", await known());
    expect(built).toEqual({ ok: true, url: "https://allhandscare.example/i/abcdefghijklmnopqrstuvwx", withKey: false });
    env.circleKeySecret = "test-secret-for-circle-keys-0123456789-abcdefghijklmnop";
  });
});

describe("who is handed a circle's key", () => {
  test("a person with a link is never handed it, and the database is not asked", async () => {
    newCircle(sealCircleKey(OLD_KEY, CIRCLE, 1));
    signedIn = family;
    expect(await openCircleKeyAction(CIRCLE)).toEqual({ ok: false, error: "Sign in to continue." });
    expect(await handOverCircleKeyAction({ circleId: CIRCLE, key: bytesToBase64Url(OLD_KEY), keyVersion: 1 })).toMatchObject({ ok: false });
    expect(await startFreshCircleKeyAction(CIRCLE)).toMatchObject({ ok: false });
    expect(await getCircleKeyState(family, CIRCLE)).toBeNull();
    expect(clientFor).not.toHaveBeenCalled();
    expect(state.touched).toEqual([]);
  });

  test("another caregiver is never handed it", async () => {
    newCircle(sealCircleKey(OLD_KEY, CIRCLE, 1));
    // getActor gives a caregiver no role in a circle that is not theirs.
    signedIn = { ...other, role: null };
    const refused = await openCircleKeyAction(CIRCLE);
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(refused)).not.toContain(bytesToBase64Url(OLD_KEY));
    expect(state.touched).toEqual([]);
    // Even past the permission check, row security shows them no row to open.
    const forged: Actor = { ...other, circleIds: [OTHER_CIRCLE, CIRCLE] };
    signedIn = forged;
    expect(await openCircleKeyAction(CIRCLE)).toEqual({ ok: false, error: "That circle was not found." });
  });

  test("nobody signed in is handed nothing", async () => {
    newCircle(sealCircleKey(OLD_KEY, CIRCLE, 1));
    expect(await openCircleKeyAction(CIRCLE)).toEqual({ ok: false, error: "Sign in to continue." });
    expect(await openCircleKeyAction("not-a-circle")).toMatchObject({ ok: false });
  });

  test("too many requests in an hour are refused before any key is read", async () => {
    newCircle(sealCircleKey(OLD_KEY, CIRCLE, 1));
    signedIn = owner;
    underLimit.mockResolvedValue(false);
    const refused = await openCircleKeyAction(CIRCLE);
    expect(refused.ok).toBe(false);
    expect(underLimit).toHaveBeenCalledWith("user-owner", "circle-key", 120);
    expect(state.touched).toEqual([]);
  });

  test("a stored key copied from one circle's row to another's opens nothing", async () => {
    newCircle(sealCircleKey(OLD_KEY, CIRCLE, 1));
    // Someone with a copy of the database and an account of their own puts the stored key on their own row.
    state.circle_caregivers.find((row) => row.circle_id === OTHER_CIRCLE)!.circle_key_wrapped = stored().circle_key_wrapped;
    signedIn = other;
    const result = await openCircleKeyAction(OTHER_CIRCLE);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(bytesToBase64Url(OLD_KEY));
  });

  test("a stored key that does not open is left alone, never replaced", async () => {
    newCircle(sealCircleKey(OLD_KEY, CIRCLE, 1));
    signedIn = owner;
    const before = stored().circle_key_wrapped;
    env.circleKeySecret = "a-different-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
    expect((await openCircleKeyAction(CIRCLE)).ok).toBe(false);
    expect((await startFreshCircleKeyAction(CIRCLE)).ok).toBe(false);
    env.circleKeySecret = "test-secret-for-circle-keys-0123456789-abcdefghijklmnop";
    expect(stored().circle_key_wrapped).toBe(before);
  });
});

describe("a circle that had recovery words", () => {
  test("a device that still has the key hands it over silently, and every device opens the photos after that", async () => {
    const documentId = await circleWithWords();
    device.set(CIRCLE, { circleId: CIRCLE, key: await importCircleKey(OLD_KEY), keyVersion: 1 });
    expect(await known()).toEqual({ keyVersion: 1, state: "words" });

    const here = await ensureCircleKey(CIRCLE);
    expect(here.ok).toBe(true);
    expect(stored().circle_key_wrapped).toMatch(/^av2\./);
    expect(openStored(stored().circle_key_wrapped!, CIRCLE, 1)).toEqual(OLD_KEY);

    device = new Map();
    const elsewhere = await ensureCircleKey(CIRCLE);
    expect(elsewhere.ok).toBe(true);
    if (!elsewhere.ok) return;
    expect(await openPhoto(documentId, elsewhere.key)).toEqual(PHOTO);
  });

  test("a wrong key on a device is refused, and the words still work afterwards", async () => {
    await circleWithWords();
    device.set(CIRCLE, { circleId: CIRCLE, key: await importCircleKey(new Uint8Array(32).fill(9)), keyVersion: 1 });
    const result = await ensureCircleKey(CIRCLE);
    expect(result).toMatchObject({ ok: false, reason: "words" });
    expect(stored().circle_key_wrapped).toBe(WORDS_WRAPPED);
  });

  test("with no device holding it, the caregiver is told, with the count, and no key is sent", async () => {
    await circleWithWords();
    const result = await ensureCircleKey(CIRCLE);
    expect(result).toEqual({ ok: false, reason: "words", old: { wrapped: WORDS_WRAPPED, keyVersion: 1, savedFiles: 1 } });
  });

  test("I still have my words: typed once, the photos open here and on every device after", async () => {
    const documentId = await circleWithWords();
    const asked = await ensureCircleKey(CIRCLE);
    if (asked.ok || asked.reason !== "words") throw new Error("expected the words to be asked for");

    expect(await openOldKeyWithWords(CIRCLE, asked.old, "legal winner thank year wave sausage worth useful legal winner thank yellow")).toMatchObject({ ok: false, reason: "failed", error: "Those words did not open the saved photos." });
    expect(await openOldKeyWithWords(CIRCLE, asked.old, "abandon about")).toMatchObject({ ok: false, error: "Enter all 12 words." });
    expect(stored().circle_key_wrapped).toBe(WORDS_WRAPPED);

    const opened = await openOldKeyWithWords(CIRCLE, asked.old, `  ${WORDS.toUpperCase()} `);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(await openPhoto(documentId, opened.key)).toEqual(PHOTO);

    device = new Map();
    const elsewhere = await ensureCircleKey(CIRCLE, await known());
    expect(elsewhere.ok && (await openPhoto(documentId, elsewhere.key))).toEqual(PHOTO);
  });

  test("Start fresh removes only the photos nobody can open, and the circle works from then on", async () => {
    const documentId = await circleWithWords();
    // A summary from before files were encrypted: plain, and still readable.
    state.visit_documents.push({ id: "plain-doc", circle_id: CIRCLE, visit_date: null, clinic: null, kind: "photos", page_count: 1, paths: [`${CIRCLE}/plain-doc/1.jpg`], created_at: "2026-11-01T00:00:00Z", key_version: null, file_key_wrapped: null, file_key_iv: null });
    state.storage.set(`${CIRCLE}/plain-doc/1.jpg`, PHOTO);
    // A device left signed out elsewhere with a copy of the old key.
    const stale = new Map([[CIRCLE, { circleId: CIRCLE, key: await importCircleKey(OLD_KEY), keyVersion: 1 }]]);

    const fresh = await startFresh(CIRCLE);
    expect(fresh).toMatchObject({ ok: true, keyVersion: 2 });
    expect(state.visit_documents.map((row) => row.id)).toEqual(["plain-doc"]);
    expect(state.storage.has(`${CIRCLE}/${documentId}/1.enc`)).toBe(false);
    expect(state.storage.has(`${CIRCLE}/plain-doc/1.jpg`)).toBe(true);
    expect(state.circles.find((row) => row.id === CIRCLE)!.key_version).toBe(2);
    expect(state.activity).toEqual([{ circle_id: CIRCLE, action: "circle_key_reset" }]);
    expect(await known()).toEqual({ keyVersion: 2, state: "held" });

    // New photos are kept and open with the new key, on this device and any other.
    if (!fresh.ok) return;
    const next = await keepPhoto(fresh.key, fresh.keyVersion);
    device = stale;
    const later = await ensureCircleKey(CIRCLE, await known());
    expect(later).toMatchObject({ ok: true, keyVersion: 2 });
    expect(later.ok && (await openPhoto(next, later.key))).toEqual(PHOTO);
  });

  test("Start fresh is refused when the key is held, and nothing is removed", async () => {
    newCircle();
    signedIn = owner;
    const first = await ensureCircleKey(CIRCLE);
    if (!first.ok) throw new Error("expected a key");
    const documentId = await keepPhoto(first.key, first.keyVersion);
    const refused = await startFreshCircleKeyAction(CIRCLE);
    expect(refused).toEqual({ ok: false, error: "Saved photos in this circle can be opened, so nothing was removed." });
    expect(state.visit_documents.map((row) => row.id)).toEqual([documentId]);
    expect(state.storage.size).toBe(1);
  });

  test("when nothing was ever saved with the old key, a new one replaces it and nothing is asked", async () => {
    newCircle(WORDS_WRAPPED);
    signedIn = owner;
    const result = await ensureCircleKey(CIRCLE);
    expect(result).toMatchObject({ ok: true, keyVersion: 2 });
    expect(stored().circle_key_wrapped).toMatch(/^av2\./);
    expect(state.activity).toEqual([]);
  });
});
