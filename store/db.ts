import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "@/lib/auth";
import { env } from "@/lib/env";
import type { Ack, HandoffPayload, HandoffView, Recipient } from "@/lib/schema";
import type { CircleContent, ConsentType } from "@/lib/schema/circles";

/** Row shape of public.handoffs (supabase/migrations/0001_init.sql). */
export interface HandoffRow {
  token: string;
  manage_key_hash: string;
  pin_hash: string | null;
  pin_failures: number;
  locked_until: string | null;
  payload: HandoffPayload;
  source_text: string | null;
  original_path: string | null;
  created_by: string | null;
  recipients: Recipient[];
  acks: Ack[];
  created_at: string;
  expires_at: string;
  /** "invite": personal links only (P1). "link": one shared link (older handoffs). Absent before migration 0002. */
  access_mode?: "link" | "invite";
  /** PIN lockouts so far on the shared link. Absent before migration 0003. */
  pin_lock_count?: number;
}

let service: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS.
 * Helpers use this path. `lib/permissions.ts` is the only lock for them.
 * Handoff routes still use it too (`db()`), same as before circles existed.
 */
export function serviceClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) throw new Error("Supabase is not configured");
  service ??= createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return service;
}

/** @deprecated Use serviceClient. Kept so existing handoff code can keep calling db(). */
export function db(): SupabaseClient {
  return serviceClient();
}

/** A caregiver's own session. RLS applies. The token was captured by getActor. */
export function userClient(accessToken: string): SupabaseClient {
  if (!env.supabaseUrl || !env.anonKey) throw new Error("Supabase is not configured");
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Caregiver: their JWT, so RLS isolates circles.
 * Helper: service role. permissions.ts must run before any query.
 */
export function clientFor(actor: Actor): SupabaseClient {
  if (actor.kind === "helper") return serviceClient();
  return userClient(actor.accessToken);
}

/**
 * One RPC writes the circle, the owner's wrapped key, consents, and activity.
 * owner_id, role, and key_version are fixed in the database. The browser sends only the wrapped key.
 */
export async function createCircleRecord(
  actor: Actor,
  input: {
    content: CircleContent;
    circleKeyWrapped?: string;
    consents: { type: ConsentType; version: string; text_hash: string }[];
  },
): Promise<string> {
  if (actor.kind !== "caregiver") throw new Error("create_circle failed");
  const { data, error } = await clientFor(actor).rpc("create_circle", {
    p_content: input.content,
    p_consents: input.consents,
    p_wrapped: input.circleKeyWrapped ?? null,
  });
  if (error || typeof data !== "string" || data === "") throw new Error("create_circle failed");
  return data;
}

export async function getHandoff(token: string): Promise<HandoffRow | null> {
  const { data, error } = await db().from("handoffs").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  return (data as HandoffRow | null) ?? null;
}

export const isExpired = (row: Pick<HandoffRow, "expires_at">) => new Date(row.expires_at).getTime() <= Date.now();

export function toView(row: HandoffRow): HandoffView {
  return {
    token: row.token,
    payload: row.payload,
    createdByFirstName: row.created_by ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    recipients: row.recipients ?? [],
    ackCount: (row.acks ?? []).length,
    hasOriginal: !!row.original_path,
  };
}

export type GoneReason = "deleted" | "expired";

export async function addTombstone(tokenHash: string, reason: GoneReason): Promise<void> {
  await db().from("handoff_tombstones").upsert({ token_hash: tokenHash, reason }, { onConflict: "token_hash" });
}

export async function getTombstone(tokenHash: string): Promise<GoneReason | null> {
  const { data } = await db().from("handoff_tombstones").select("reason").eq("token_hash", tokenHash).maybeSingle();
  return (data?.reason as GoneReason | undefined) ?? null;
}

/** Deletes the stored original (if any), the row, and leaves tombstones for the link and every personal invitation. */
export async function hardDeleteHandoff(row: Pick<HandoffRow, "token" | "original_path">, reason: GoneReason, tokenHash: string) {
  const { deleteOriginal } = await import("@/lib/storage");
  await deleteOriginal(row.original_path);
  const { data: invites } = await db().from("handoff_recipients").select("invite_hash").eq("handoff_token", row.token);
  for (const r of (invites ?? []) as { invite_hash: string }[]) await addTombstone(r.invite_hash, reason);
  const { error } = await db().from("handoffs").delete().eq("token", row.token);
  if (error) throw error;
  await addTombstone(tokenHash, reason);
}
