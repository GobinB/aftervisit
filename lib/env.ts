import "server-only";

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  /** Publishable key. Required for Google sign-in and for a caregiver's own session (RLS). */
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  ttlDays: num(process.env.HANDOFF_TTL_DAYS, 30),
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 10),
  cronSecret: process.env.CRON_SECRET ?? "",
  // Server salt for IP, PIN and manage-key hashes.
  salt: process.env.IP_HASH_SALT ?? "",
  /** HMAC key for helper-link cookies. Empty means helper sign-in is off. */
  helperSessionSecret: process.env.HELPER_SESSION_SECRET ?? "",
};

export const RATE_LIMITS = { extract: 10, create: 10, ack: 30, update: 60, manage: 60, feedback: 20 } as const;
