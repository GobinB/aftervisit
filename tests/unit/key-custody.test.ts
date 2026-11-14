import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const env = { circleKeySecret: "" };
vi.mock("@/lib/env", () => ({ env }));

const { canHoldKeys, decodeKey, encodeKey, newCircleKey, openCircleKey, opensFileKey, sameKey, sealCircleKey } = await import("@/lib/key-custody");
const { generateFileKey, importCircleKey, unwrapFileKey, wrapFileKey } = await import("@/lib/crypto/keys");
const { exportKeyBytes } = await import("@/lib/crypto/export");
const { HELD_CIRCLE_KEY } = await import("@/lib/schema/circles");

const SECRET = "test-secret-for-circle-keys-0123456789-abcdefghijklmnop";
const CIRCLE = "22222222-2222-4222-8222-222222222222";
const OTHER_CIRCLE = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  env.circleKeySecret = SECRET;
});

describe("the key All Hands Care keeps for a circle", () => {
  test("is stored wrapped, and opens again with the same secret, circle and version", () => {
    const raw = newCircleKey();
    const stored = sealCircleKey(raw, CIRCLE, 1);
    expect(HELD_CIRCLE_KEY.test(stored)).toBe(true);
    expect(stored).not.toContain(encodeKey(raw));
    expect(Buffer.from(stored).includes(Buffer.from(raw))).toBe(false);
    expect(openCircleKey(stored, CIRCLE, 1)).toEqual(raw);
  });

  test("wraps the same key differently each time", () => {
    const raw = newCircleKey();
    expect(sealCircleKey(raw, CIRCLE, 1)).not.toBe(sealCircleKey(raw, CIRCLE, 1));
  });

  test("the database alone opens nothing: without the secret, or with another one, the stored key stays shut", () => {
    const stored = sealCircleKey(newCircleKey(), CIRCLE, 1);
    env.circleKeySecret = "another-secret-entirely-0123456789-abcdefghijklmnopqr";
    expect(() => openCircleKey(stored, CIRCLE, 1)).toThrow(/could not be opened/);
    env.circleKeySecret = "";
    expect(canHoldKeys()).toBe(false);
    expect(() => openCircleKey(stored, CIRCLE, 1)).toThrow(/CIRCLE_KEY_SECRET is not set/);
    expect(() => sealCircleKey(newCircleKey(), CIRCLE, 1)).toThrow(/CIRCLE_KEY_SECRET is not set/);
  });

  test("a secret that is too short is treated as missing", () => {
    env.circleKeySecret = "short";
    expect(canHoldKeys()).toBe(false);
    expect(() => sealCircleKey(newCircleKey(), CIRCLE, 1)).toThrow();
  });

  test("a stored key copied to another circle, or to another version, does not open", () => {
    const stored = sealCircleKey(newCircleKey(), CIRCLE, 1);
    expect(() => openCircleKey(stored, OTHER_CIRCLE, 1)).toThrow(/could not be opened/);
    expect(() => openCircleKey(stored, CIRCLE, 2)).toThrow(/could not be opened/);
  });

  test("a stored key that was changed does not open", () => {
    const stored = sealCircleKey(newCircleKey(), CIRCLE, 1);
    const last = stored.at(-1) === "A" ? "B" : "A";
    expect(() => openCircleKey(stored.slice(0, -1) + last, CIRCLE, 1)).toThrow();
    expect(() => openCircleKey("av1.600000." + "a".repeat(22) + "." + "b".repeat(16) + "." + "c".repeat(64), CIRCLE, 1)).toThrow(/not valid/);
    expect(() => openCircleKey("not a key", CIRCLE, 1)).toThrow(/not valid/);
  });

  test("errors never carry key bytes", () => {
    const raw = newCircleKey();
    const stored = sealCircleKey(raw, CIRCLE, 1);
    try {
      openCircleKey(stored, OTHER_CIRCLE, 1);
      throw new Error("should not open");
    } catch (caught) {
      const text = String((caught as Error).message) + String((caught as Error).stack);
      expect(text).not.toContain(encodeKey(raw));
      expect(text).not.toContain(stored);
    }
  });

  test("only 32-byte keys are kept", () => {
    expect(() => sealCircleKey(new Uint8Array(16), CIRCLE, 1)).toThrow(/not valid/);
    expect(() => decodeKey("abc")).toThrow(/not valid/);
    const raw = newCircleKey();
    expect(decodeKey(encodeKey(raw))).toEqual(raw);
    expect(sameKey(raw, decodeKey(encodeKey(raw)))).toBe(true);
    expect(sameKey(raw, newCircleKey())).toBe(false);
  });
});

describe("the key the server hands over is the one the browser uses", () => {
  test("a key released by the server opens a file key the browser wrapped", async () => {
    const raw = newCircleKey();
    const stored = sealCircleKey(raw, CIRCLE, 1);
    // The browser, first device: wraps a summary's file key with the circle key it was handed.
    const fileKey = await generateFileKey();
    const wrapped = await wrapFileKey(fileKey, await importCircleKey(raw), 1);
    // Another device, later: handed the key again after sign-in.
    const again = await importCircleKey(openCircleKey(stored, CIRCLE, 1));
    expect(await exportKeyBytes(await unwrapFileKey(wrapped, again, true))).toEqual(await exportKeyBytes(fileKey));
  });

  test("the server can tell a right circle key from a wrong one by a saved summary's file key", async () => {
    const raw = newCircleKey();
    const wrapped = await wrapFileKey(await generateFileKey(), await importCircleKey(raw), 1);
    expect(opensFileKey(raw, wrapped)).toBe(true);
    expect(opensFileKey(new Uint8Array(randomBytes(32)), wrapped)).toBe(false);
    expect(opensFileKey(raw, { fileKeyWrapped: "A".repeat(64), fileKeyIv: wrapped.fileKeyIv })).toBe(false);
    expect(opensFileKey(raw, { fileKeyWrapped: "short", fileKeyIv: "short" })).toBe(false);
  });
});
