import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { caregiverDisplayName } from "@/lib/caregiver-name";
import { env } from "@/lib/env";
import { HELPER_COOKIE, readHelperCookie, sameLink, signHelperCookie, type HelperClaim } from "@/lib/helper-cookie";
import { HELPER_ROLES, MEMBER_TTL_DAYS, VisibilitySchema, type HelperRole, type Visibility } from "@/lib/schema/circles";
import { serviceClient, userClient } from "@/store/db";
import { createSupabaseServerClient } from "@/store/supabase-server";
import { caregiverHome, LAST_CIRCLE_COOKIE } from "@/lib/home-path";

/** One caregiver signs in per circle: its owner. Everyone else uses a personal link. */
export type CaregiverRole = "owner";

/**
 * The signed-in person for one request.
 * Caregiver fields include the circles they belong to. `role` is for the circle passed to getActor.
 * Helper `role` and `visibility` come from the member row, never from the cookie alone.
 * `accessToken` is captured here so nothing downstream reads cookies or headers.
 */
export type Actor =
  | {
      kind: "caregiver";
      userId: string;
      /** The caregiver's own name from Google, when it has one. */
      name?: string | null;
      circleIds: string[];
      role: CaregiverRole | null;
      accessToken: string;
    }
  | {
      kind: "helper";
      memberId: string;
      circleId: string;
      role: HelperRole;
      visibility: Visibility;
    };

const SEEN_MS = 60_000;
const COOKIE_MAX_AGE = MEMBER_TTL_DAYS * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
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
  accessToken: string;
  circleIds: string[];
  roles: Record<string, CaregiverRole>;
};

/** Once per request: the layout, the page and its parts all ask, and Supabase is called only the first time. */
const loadCaregiver = cache(async function loadCaregiver(): Promise<CaregiverRecord | null> {
  if (!env.supabaseUrl || !env.anonKey) return null;
  try {
    const supabase = await createSupabaseServerClient();
    // getClaims verifies the session's signature locally (ES256 public key, cached), so a page
    // does not wait on the auth server. The middleware has already refreshed an expired session.
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    if (claimsError || !claims?.sub) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return null;
    const user = { id: claims.sub, name: caregiverDisplayName(claims.user_metadata) };
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
    return { userId: user.id, name: user.name, accessToken, circleIds, roles };
  } catch {
    return null;
  }
});

async function loadHelper(circleId: string): Promise<Actor | null> {
  if (!env.helperSessionSecret) return null;
  try {
    const jar = await cookies();
    const claim = readHelperCookie(jar.get(HELPER_COOKIE)?.value, env.helperSessionSecret).find((row) => row.circleId === circleId);
    if (!claim) return null;
    const db = serviceClient();
    const { data, error } = await db
      .from("members")
      .select("id, role, visibility, revoked_at, expires_at, last_seen_at, token_hash")
      .eq("id", claim.memberId)
      .eq("circle_id", circleId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.revoked_at) return null;
    // Made from an older link: "New link" signs those devices out.
    if (!sameLink(claim.link, data.token_hash as string | null)) return null;
    if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
    const role = data.role as string;
    if (!HELPER_ROLES.includes(role as HelperRole)) return null;
    const parsed = VisibilitySchema.safeParse(data.visibility ?? {});
    const visibility = parsed.success ? parsed.data : {};
    const seen = data.last_seen_at ? new Date(data.last_seen_at as string).getTime() : 0;
    if (Date.now() - seen >= SEEN_MS) {
      await db
        .from("members")
        .update({
          last_seen_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + MEMBER_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", data.id as string);
    }
    // The role always comes from the member row; the cookie's copy is never trusted or rewritten here.
    const helperRole = role as HelperRole;
    return { kind: "helper", memberId: data.id as string, circleId, role: helperRole, visibility };
  } catch {
    return null;
  }
}

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
      circleIds: caregiver.circleIds,
      role: caregiver.roles[circleId] ?? null,
      accessToken: caregiver.accessToken,
    };
  }
  if (circleId) {
    const helper = await loadHelper(circleId);
    if (helper) return helper;
  }
  if (caregiver && !circleId) {
    return {
      kind: "caregiver",
      userId: caregiver.userId,
      name: caregiver.name,
      circleIds: caregiver.circleIds,
      role: null,
      accessToken: caregiver.accessToken,
    };
  }
  return null;
});

/**
 * Where the installed app opens. A caregiver goes to their circle (see caregiverHome). Someone with a helper link
 * goes to the first circle whose link still works. Anyone else gets the home page.
 */
export async function homePath(): Promise<string> {
  const caregiver = await loadCaregiver();
  if (caregiver) {
    const jar = await cookies();
    return caregiverHome(caregiver.circleIds, jar.get(LAST_CIRCLE_COOKIE)?.value);
  }
  if (!env.helperSessionSecret) return "/";
  try {
    const jar = await cookies();
    const claims = readHelperCookie(jar.get(HELPER_COOKIE)?.value, env.helperSessionSecret);
    for (const claim of claims) {
      if (await loadHelper(claim.circleId)) return `/circles/${claim.circleId}`;
    }
  } catch {}
  return "/";
}
