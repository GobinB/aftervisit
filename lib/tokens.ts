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
