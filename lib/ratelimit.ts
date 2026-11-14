import "server-only";
import { db } from "./db";
import { hashIp } from "./tokens";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Counts this request against an hourly bucket for the caller's salted IP hash.
 * Returns false when the caller is over the limit. Fails open if the database is
 * unreachable so a storage hiccup never blocks a caregiver.
 */
export async function checkRateLimit(req: Request, bucket: string, limit: number): Promise<boolean> {
  try {
    const { data, error } = await db().rpc("check_rate_limit", {
      p_ip_hash: hashIp(clientIp(req)),
      p_bucket: bucket,
      p_limit: limit,
    });
    if (error) {
      console.error("rate limit check failed:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("rate limit check failed:", (e as Error).message);
    return true;
  }
}

/**
 * A daily counter for a signed-in caregiver: true while they are under the limit today (UTC day).
 * Unlike the hourly counters, it fails closed. It guards the outside reader, and when it says no the
 * built-in reader is used instead, so a database hiccup never blocks a caregiver.
 */
export async function checkDailyLimit(userId: string, bucket: string, limit: number): Promise<boolean> {
  try {
    const { data, error } = await db().rpc("check_daily_limit", {
      p_ip_hash: hashIp(`user:${userId}`),
      p_bucket: bucket,
      p_limit: limit,
    });
    if (error) {
      console.error("daily limit check failed:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("daily limit check failed:", (e as Error).message);
    return false;
  }
}

/**
 * The same hourly counter for a signed-in caregiver, for server actions, which have no request to
 * read an address from. Counted per account, so it follows the person across networks.
 */
export async function checkActorRateLimit(userId: string, bucket: string, limit: number): Promise<boolean> {
  try {
    const { data, error } = await db().rpc("check_rate_limit", {
      p_ip_hash: hashIp(`user:${userId}`),
      p_bucket: bucket,
      p_limit: limit,
    });
    if (error) {
      console.error("rate limit check failed:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("rate limit check failed:", (e as Error).message);
    return true;
  }
}
