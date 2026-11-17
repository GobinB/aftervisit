import { sameLink } from "@/lib/helper-cookie";
import { HELPER_ROLES, VisibilitySchema, type HelperRole, type Visibility } from "@/lib/schema/circles";

/** The member row fields that decide whether a person may open their circle. */
export type MemberAccessRow = {
  id: string;
  role: string;
  visibility: unknown;
  revoked_at: string | null;
  expires_at: string;
  token_hash: string | null;
  user_id: string | null;
};

/**
 * How the person arrived: with the cookie their link set on this device, or signed in with the
 * account they saved their link to.
 */
export type HelperAccess = { via: "link"; link: string } | { via: "account"; userId: string };

export type HelperActorFields = {
  kind: "helper";
  memberId: string;
  circleId: string;
  role: HelperRole;
  visibility: Visibility;
  /** Set when the person is signed in with the account their link is saved to. */
  userId?: string;
};

/**
 * One rule for both ways in. A removed or ended row is refused. A row saved to an account opens only
 * for that account: its link (and any device that opened the link before) no longer works on its
 * own. A row not saved to an account opens only with the cookie from its current link. Role and
 * what the person sees always come from the row, never from the cookie or the session.
 */
export function helperFromRow(row: MemberAccessRow, circleId: string, access: HelperAccess, now = Date.now()): HelperActorFields | null {
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= now) return null;
  if (!HELPER_ROLES.includes(row.role as HelperRole)) return null;
  if (access.via === "account") {
    if (!row.user_id || row.user_id !== access.userId) return null;
  } else {
    if (row.user_id) return null;
    // Made from an older link: "New link" signs those devices out.
    if (!sameLink(access.link, row.token_hash)) return null;
  }
  const parsed = VisibilitySchema.safeParse(row.visibility ?? {});
  return {
    kind: "helper",
    memberId: row.id,
    circleId,
    role: row.role as HelperRole,
    visibility: parsed.success ? parsed.data : {},
    ...(access.via === "account" ? { userId: access.userId } : {}),
  };
}
