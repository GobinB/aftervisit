import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { HELD_CIRCLE_KEY } from "@/lib/schema/circles";

/**
 * All Hands Care keeps each circle's key for files so a caregiver gets it back after signing in.
 * The key is stored wrapped (docs/decisions/0015-file-encryption.md). The wrapping key is derived
 * here from CIRCLE_KEY_SECRET, which lives only in the server's environment, and from the circle's
 * id, so the database alone opens nothing and one circle's stored key cannot be opened as another's.
 *
 * Nothing in this file logs, and no error it throws carries key bytes.
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_SECRET_LENGTH = 32;

function secret(): Buffer {
  const value = env.circleKeySecret;
  if (value.length < MIN_SECRET_LENGTH) throw new Error("CIRCLE_KEY_SECRET is not set.");
  return Buffer.from(value, "utf8");
}

/** True when this deployment can keep and hand back keys. */
export function canHoldKeys(): boolean {
  return env.circleKeySecret.length >= MIN_SECRET_LENGTH;
}

/** HKDF-SHA256 over the secret. The circle id is in the derivation, so every circle has its own wrapping key. */
function wrappingKey(circleId: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret(), Buffer.from("ahc-circle-key-v2", "utf8"), Buffer.from(`circle:${circleId}`, "utf8"), KEY_BYTES));
}

/** Bound into the wrap, so a stored key does not open under another circle or another key version. */
function label(circleId: string, keyVersion: number): Buffer {
  return Buffer.from(`ahc-circle-key:${circleId}:${keyVersion}`, "utf8");
}

export function newCircleKey(): Uint8Array {
  return new Uint8Array(randomBytes(KEY_BYTES));
}

/** Wraps a raw circle key for storage. The result is the only form of the key the database holds. */
export function sealCircleKey(raw: Uint8Array, circleId: string, keyVersion: number): string {
  if (raw.length !== KEY_BYTES) throw new Error("Circle key is not valid.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey(circleId), iv);
  cipher.setAAD(label(circleId, keyVersion));
  const sealed = Buffer.concat([cipher.update(raw), cipher.final(), cipher.getAuthTag()]);
  return `av2.${iv.toString("base64url")}.${sealed.toString("base64url")}`;
}

/** Opens a stored key. Throws when the secret, the circle or the version is not the one it was wrapped with. */
export function openCircleKey(stored: string, circleId: string, keyVersion: number): Uint8Array {
  const match = HELD_CIRCLE_KEY.exec(stored);
  if (!match) throw new Error("Stored key is not valid.");
  const iv = Buffer.from(match[1] ?? "", "base64url");
  const sealed = Buffer.from(match[2] ?? "", "base64url");
  if (iv.length !== IV_BYTES || sealed.length !== KEY_BYTES + TAG_BYTES) throw new Error("Stored key is not valid.");
  const decipher = createDecipheriv("aes-256-gcm", wrappingKey(circleId), iv);
  decipher.setAAD(label(circleId, keyVersion));
  decipher.setAuthTag(sealed.subarray(KEY_BYTES));
  try {
    return new Uint8Array(Buffer.concat([decipher.update(sealed.subarray(0, KEY_BYTES)), decipher.final()]));
  } catch {
    throw new Error("Stored key could not be opened.");
  }
}

/**
 * Whether a circle key is the one a saved summary's file key was wrapped with in the browser
 * (AES-GCM, lib/crypto/keys.ts). Used before a key handed over by a device is kept, so a wrong
 * key never replaces the right one. The file key itself is thrown away.
 */
export function opensFileKey(circleKey: Uint8Array, file: { fileKeyWrapped: string; fileKeyIv: string }): boolean {
  try {
    const iv = Buffer.from(file.fileKeyIv, "base64url");
    const wrapped = Buffer.from(file.fileKeyWrapped, "base64url");
    if (circleKey.length !== KEY_BYTES || iv.length !== IV_BYTES || wrapped.length !== KEY_BYTES + TAG_BYTES) return false;
    const decipher = createDecipheriv("aes-256-gcm", circleKey, iv);
    decipher.setAuthTag(wrapped.subarray(KEY_BYTES));
    decipher.update(wrapped.subarray(0, KEY_BYTES));
    decipher.final();
    return true;
  } catch {
    return false;
  }
}

export function sameKey(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function encodeKey(raw: Uint8Array): string {
  return Buffer.from(raw).toString("base64url");
}

export function decodeKey(encoded: string): Uint8Array {
  const raw = new Uint8Array(Buffer.from(encoded, "base64url"));
  if (raw.length !== KEY_BYTES) throw new Error("Circle key is not valid.");
  return raw;
}
