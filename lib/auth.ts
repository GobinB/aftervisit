import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { caregiverDisplayName } from "@/lib/caregiver-name";
import { env } from "@/lib/env";
import { HELPER_COOKIE, readHelperCookie, signHelperCookie, type HelperClaim } from "@/lib/helper-cookie";
import { helperFromRow, type HelperAccess, type HelperActorFields, type MemberAccessRow } from "@/lib/helper-actor";
import { MEMBER_TTL_DAYS } from "@/lib/schema/circles";
import { serviceClient, userClient } from "@/store/db";
import { createSupabaseServerClient } from "@/store/supabase-server";
import { caregiverHome, LAST_CIRCLE_COOKIE } from "@/lib/home-path";
import { linkExpiry } from "@/lib/link-life";
import { secureCookies } from "@/lib/session-cookie";

/**
 * One caregiver runs each circle: its owner. Everyone else opens their personal link, or, if they
 * saved that link to their Google account, signs in.
 */
export type CaregiverRole = "owner";

/**
 * The person behind one request.
 * Caregiver fields include the circles they run. `role` is for the circle passed to getActor. Anyone
 * signed in with Google who is not inside one of their own circles is also "caregiver" here, with a
 * null role and no circle: that is what /circles and starting a circle need.
 * A helper is someone in the circle, from their link's cookie or signed in with the account their
 * link is saved to (then `userId` is set). Their `role` and `visibility` always come from the member
 * row, never from the cookie or the session.
 * `accessToken` is captured here so nothing downstream reads cookies or headers.
 */
export type Actor =
  | {
      kind: "caregiver";
      userId: string;
      /** The caregiver's own name from Google, when it has one. */
      name?: string | null;
      /** Their Google email, when the session carries it. Shown to them, never to others. */
      email?: string | null;
      circleIds: string[];
      role: CaregiverRole | null;
      accessToken: string;
    }
  | HelperActorFields;

const SEEN_MS = 60_000;
const COOKIE_MAX_AGE = MEMBER_TTL_DAYS * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies(),
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Adds or replaces this circle's helper session. Other circles in the cookie stay. */
export async function setHelperSession(claim: HelperClaim): Promise<boolean> {
  if (!env.helperSessionSecret) return false;
  const jar = await cookies();
  const current = readHelperCookie(jar.get(HELPER_COOKIE)?.value, env.helperSessionSecret);
  const next = [...current.filter((row) => row.circleId !== claim.circleId), claim];
  jar.set(HELPER_COOKIE, signHelperCookie(next, env.helperSessionSecret), cookieOptions());
  return true;
}

type CaregiverRecord = {
  userId: string;
  name: string | null;
  email: string | null;
  accessToken: string;
  circleIds: string[];
  roles: Record<string, CaregiverRole>;
};

/**
 * Whoever is signed in with Google, and the circles they run (none for someone who only helps).
 * Once per request: the layout, the page and its parts all ask, and Supabase is called only the first time.
 */
const loadCaregiver = cache(async function loadCaregiver(): Promise<CaregiverRecord | null> {
  if (!env.supabaseUrl || !env.anonKey) return null;
  try {
    const supabase = await createSupabaseServerClient();
    // getClaims verifies the session's signature locally (ES256 public key, cached), so a page
    // does not wait on the auth server. proxy.ts has already refreshed an expired session.
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    if (claimsError || !claims?.sub) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return null;
    const user = { id: claims.sub, name: caregiverDisplayName(claims.user_metadata), email: typeof claims.email === "string" && claims.email ? claims.email : null };
    const db = userClient(accessToken);
    const [{ data: memberships, error }, { data: circles }] = await Promise.all([
      db.from("circle_caregivers").select("circle_id, role"),
      db.from("circles").select("id").is("deleted_at", null),
    ]);
    if (error) return null;
    const live = new Set((circles ?? []).map((circle) => circle.id as string));
    const roles: Record<string, CaregiverRole> = {};
    const circleIds: string[] = [];
    for (const row of memberships ?? []) {
      const circleId = row.circle_id as string;
      const role = row.role as string;
      if (!live.has(circleId)) continue;
      if (role !== "owner") continue;
      roles[circleId] = role;
      circleIds.push(circleId);
    }
    return { userId: user.id, name: user.name, email: user.email, accessToken, circleIds, roles };
  } catch {
    return null;
  }
});

const MEMBER_ACCESS_FIELDS = "id, role, visibility, revoked_at, expires_at, token_hash, user_id, last_seen_at, link_issued_at";
type MemberRecord = MemberAccessRow & { last_seen_at: string | null; link_issued_at: string };

/** Marks the person as seen (at most once a minute) and moves their link's end date on. */
async function touchSeen(row: MemberRecord) {
  const seen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  if (Date.now() - seen < SEEN_MS) return;
  await serviceClient()
    .from("members")
    .update({
      last_seen_at: new Date().toISOString(),
      // Another 30 days from now, but never past 90 days from when the link was made.
      expires_at: linkExpiry(new Date(row.link_issued_at)).toISOString(),
    })
    .eq("id", row.id);
}

/** A person in this circle: signed in with the account their link is saved to, or with their link's cookie. */
async function loadHelper(circleId: string, userId: string | null): Promise<Actor | null> {
  try {
    const db = serviceClient();
    if (userId) {
      const { data, error } = await db.from("members").select(MEMBER_ACCESS_FIELDS).eq("circle_id", circleId).eq("user_id", userId).maybeSingle();
      const row = error ? null : (data as MemberRecord | null);
      const actor = row ? helperFromRow(row, circleId, { via: "account", userId }) : null;
      if (row && actor) {
        await touchSeen(row);
        return actor;
      }
    }
    if (!env.helperSessionSecret) return null;
    const jar = await cookies();
    const claim = readHelperCookie(jar.get(HELPER_COOKIE)?.value, env.helperSessionSecret).find((row) => row.circleId === circleId);
    if (!claim) return null;
    const { data, error } = await db.from("members").select(MEMBER_ACCESS_FIELDS).eq("id", claim.memberId).eq("circle_id", circleId).maybeSingle();
    if (error || !data) return null;
    const row = data as MemberRecord;
    const access: HelperAccess = { via: "link", link: claim.link };
    const actor = helperFromRow(row, circleId, access);
    if (!actor) return null;
    await touchSeen(row);
    return actor;
  } catch {
    return null;
  }
}

/** The live circles a signed-in person helps in through their account. Ids only; services/circles.ts names them. */
const loadAccountMemberships = cache(async function loadAccountMemberships(userId: string): Promise<string[]> {
  try {
    const { data, error } = await serviceClient()
      .from("members")
      .select("circle_id, revoked_at, expires_at, circles!inner(deleted_at)")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .is("circles.deleted_at", null);
    if (error || !data) return [];
    return data.map((row) => row.circle_id as string);
  } catch {
    return [];
  }
});

/**
 * Resolves the actor for this request. Pass a circle when the page is inside one.
 * Nothing that calls this should read cookies or headers itself.
 */
export const getActor = cache(async function getActor(circleId?: string): Promise<Actor | null> {
  const caregiver = await loadCaregiver();
  if (caregiver && circleId && caregiver.circleIds.includes(circleId)) {
    return {
      kind: "caregiver",
      userId: caregiver.userId,
      name: caregiver.name,
      email: caregiver.email,
      circleIds: caregiver.circleIds,
      role: caregiver.roles[circleId] ?? null,
      accessToken: caregiver.accessToken,
    };
  }
  if (circleId) {
    const helper = await loadHelper(circleId, caregiver?.userId ?? null);
    if (helper) return helper;
  }
  if (caregiver && !circleId) {
    return {
      kind: "caregiver",
      userId: caregiver.userId,
      name: caregiver.name,
      email: caregiver.email,
      circleIds: caregiver.circleIds,
      role: null,
      accessToken: caregiver.accessToken,
    };
  }
  return null;
});

/**
 * Where the installed app opens. Someone signed in goes to their circle (see caregiverHome), counting
 * the circles they help in as well as the ones they run. Someone with a helper link goes to the first
 * circle whose link still works. Anyone else gets the home page.
 */
export async function homePath(): Promise<string> {
  const caregiver = await loadCaregiver();
  const jar = await cookies();
  if (caregiver) {
    const all = [...caregiver.circleIds, ...(await loadAccountMemberships(caregiver.userId))];
    if (all.length) return caregiverHome(all, jar.get(LAST_CIRCLE_COOKIE)?.value);
  }
  if (env.helperSessionSecret) {
    try {
      const claims = readHelperCookie(jar.get(HELPER_COOKIE)?.value, env.helperSessionSecret);
      for (const claim of claims) {
        if (await loadHelper(claim.circleId, null)) return `/circles/${claim.circleId}`;
      }
    } catch {}
  }
  return caregiver ? "/circles" : "/";
}
