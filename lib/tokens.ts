import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { env } from "./env";

/** 21-char share token and 32-char manage key. Unguessable links are the permission model. */
export const newShareToken = () => nanoid(21);
export const newManageKey = () => nanoid(32);

export const TOKEN_RE = /^[A-Za-z0-9_-]{21}$/;
export const MANAGE_KEY_RE = /^[A-Za-z0-9_-]{32}$/;

function sha256(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

export const hashManageKey = (key: string) => sha256(env.salt, "manage", key);
/** PIN hashes are bound to the handoff token so equal PINs never share a hash. */
export const hashPin = (token: string, pin: string) => sha256(env.salt, "pin", token, pin);
export const hashIp = (ip: string) => sha256(env.salt, "ip", ip);

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
export const hashToken = (token: string) => sha256(env.salt, "token", token);

/**
 * Ticket for opening the attached original: HMAC over token + expiry. Lets a PIN-checked
 * viewer open the file without the PIN ever appearing in a URL.
 */
export function originalTicket(token: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${sha256(env.salt, "original", token, String(exp)).slice(0, 32)}`;
}

export function verifyOriginalTicket(token: string, ticket: string | null): boolean {
  const m = /^(\d{10})\.([0-9a-f]{32})$/.exec(ticket ?? "");
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  return safeEqual(m[2], sha256(env.salt, "original", token, m[1]).slice(0, 32));
}
