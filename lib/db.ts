import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Ack, HandoffPayload, HandoffView, Recipient } from "./schema";

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
}

let client: SupabaseClient | null = null;

/** Server-only client with the service-role key. The anon key is never used. */
export function db(): SupabaseClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) throw new Error("Supabase is not configured");
  client ??= createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
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
  const { deleteOriginal } = await import("./storage");
  await deleteOriginal(row.original_path);
  const { data: invites } = await db().from("handoff_recipients").select("invite_hash").eq("handoff_token", row.token);
  for (const r of (invites ?? []) as { invite_hash: string }[]) await addTombstone(r.invite_hash, reason);
  const { error } = await db().from("handoffs").delete().eq("token", row.token);
  if (error) throw error;
  await addTombstone(tokenHash, reason);
}
