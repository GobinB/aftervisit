import "server-only";
import { dataEnv, deploymentSetting } from "@/lib/data-env";

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const data = dataEnv();

/**
 * A secret the live site cannot run safely without. Missing on the production deployment, it fails
 * loudly at the first use instead of quietly making PIN and link hashes guessable.
 */
function requiredInProduction(name: string): string {
  const value = process.env[name] ?? "";
  if (!value && process.env.VERCEL_ENV === "production") throw new Error(`${name} is not set on the production deployment.`);
  return value;
}

export const env = {
  /** Production settings on the production deployment only; preview builds get PREVIEW_* or nothing (lib/data-env.ts). */
  supabaseUrl: data.supabaseUrl,
  /** Publishable key. Required for Google sign-in and for a caregiver's own session (RLS). */
  anonKey: data.anonKey,
  serviceRoleKey: deploymentSetting("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  ttlDays: num(process.env.HANDOFF_TTL_DAYS, 30),
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 10),
  cronSecret: process.env.CRON_SECRET ?? "",
  // Server salt for IP, PIN, link and manage-key hashes. Refused when missing on the live site (below).
  salt: requiredInProduction("IP_HASH_SALT"),
  /** HMAC key for helper-link cookies. Empty means helper sign-in is off. */
  helperSessionSecret: deploymentSetting("HELPER_SESSION_SECRET"),
};

export const RATE_LIMITS = { extract: 10, create: 10, ack: 30, update: 60, manage: 60, feedback: 20 } as const;
