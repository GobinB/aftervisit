import { describe, expect, test } from "vitest";
import { buildHelperLink, helperLinkForServer, parseLinkKey } from "@/lib/crypto/link";
import { decryptFile, encryptFile, exportKeyBytes, generateFileKey, importCircleKey, normalizeWords, openWithWords, unwrapFileKey, wrapFileKey } from "@/lib/crypto/keys";
import { AddMemberSchema, CreateCircleSchema, HandOverCircleKeySchema, HELD_CIRCLE_KEY, OpenMemberLinkSchema, WORDS_WRAPPED_KEY } from "@/lib/schema/circles";

const WORDS = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const OTHER = "legal winner thank year wave sausage worth useful legal winner thank yellow";
/** The key bytes 1..32, wrapped by WORDS the way circles made before migration 0017 stored it. */
const WORDS_WRAPPED = "av1.600000.BwcHBwcHBwcHBwcHBwcHBw.CQkJCQkJCQkJCQkJ.HjJDlfueDE80z1civaCUlcv2-xAJhJ3UwUMvgeL9stWx0Brhvb0uniVV013hsgWZ";
const OLD_KEY = new Uint8Array(32).map((_, index) => index + 1);
const TOKEN = "abcdefghijklmnopqrstuvwx";

const randomCircleKey = () => importCircleKey(crypto.getRandomValues(new Uint8Array(32)));

describe("a circle key made with recovery words", () => {
  test("still opens with its words, however they are typed", async () => {
    expect(WORDS_WRAPPED_KEY.test(WORDS_WRAPPED)).toBe(true);
    expect(await exportKeyBytes(await openWithWords(WORDS_WRAPPED, WORDS))).toEqual(OLD_KEY);
    expect(await exportKeyBytes(await openWithWords(WORDS_WRAPPED, `  ${WORDS.toUpperCase().replaceAll(" ", "\n")}  `))).toEqual(OLD_KEY);
    expect(normalizeWords("  Abandon   ABOUT\n")).toBe("abandon about");
  });

  test("the wrong words, too few words, or a key in the new form do not open", async () => {
    await expect(openWithWords(WORDS_WRAPPED, OTHER)).rejects.toThrow(/did not open/);
    await expect(openWithWords(WORDS_WRAPPED, "abandon abandon about")).rejects.toThrow(/all 12 words/);
    await expect(openWithWords(`av2.${"a".repeat(16)}.${"b".repeat(64)}`, WORDS)).rejects.toThrow(/not valid/);
  });

  test("the two stored forms cannot be mistaken for each other", () => {
    const held = `av2.${"a".repeat(16)}.${"b".repeat(64)}`;
    expect(HELD_CIRCLE_KEY.test(held)).toBe(true);
    expect(HELD_CIRCLE_KEY.test(WORDS_WRAPPED)).toBe(false);
    expect(WORDS_WRAPPED_KEY.test(held)).toBe(false);
    expect(HELD_CIRCLE_KEY.test(WORDS)).toBe(false);
  });
});

describe("file keys", () => {
  test("a file encrypts and decrypts with a file key the circle key wraps", async () => {
    const circle = await randomCircleKey();
    const fileKey = await generateFileKey();
    const plain = new TextEncoder().encode("Riverbend Pharmacy hours");
    const encrypted = await encryptFile(plain, fileKey);
    const stored = await wrapFileKey(fileKey, circle, 1);
    const opened = await unwrapFileKey(stored, circle);
    expect(await decryptFile(encrypted.ciphertext, encrypted.iv, opened)).toEqual(plain);
    await expect(exportKeyBytes(opened)).rejects.toThrow();
    await expect(unwrapFileKey(stored, await randomCircleKey())).rejects.toThrow();
  });

  test("a circle key is 32 bytes", async () => {
    await expect(importCircleKey(new Uint8Array(16))).rejects.toThrow(/not valid/);
  });
});

describe("helper links", () => {
  test("the key is only in the hash", async () => {
    const raw = await exportKeyBytes(await randomCircleKey());
    const link = buildHelperLink("https://aftervisit.example", TOKEN, raw);
    const url = new URL(link);
    expect(url.origin).toBe("https://aftervisit.example");
    expect(url.pathname).toBe(`/i/${TOKEN}`);
    expect(url.search).toBe("");
    expect(url.hash.startsWith("#k=")).toBe(true);
    expect(helperLinkForServer(link)).toBe(`https://aftervisit.example/i/${TOKEN}`);
    expect(helperLinkForServer(link).includes(url.hash.slice(3))).toBe(false);
    expect(parseLinkKey(url.hash)).toEqual(raw);
    expect(parseLinkKey("")).toBeNull();
    expect(parseLinkKey("#k=aaaa")).toBeNull();
  });

  test("server actions accept only their own fields: no key on a link, no words anywhere", () => {
    const circleId = "22222222-2222-4222-8222-222222222222";
    const content = { person_name: "Margaret Ward" };
    const consents = { authorized_to_share: true as const, terms: true as const, privacy: true as const };
    expect(OpenMemberLinkSchema.safeParse({ token: TOKEN, pin: "1234" }).success).toBe(true);
    expect(OpenMemberLinkSchema.safeParse({ token: TOKEN, k: "secret" }).success).toBe(false);
    expect(AddMemberSchema.safeParse({ circleId, name: "Rosa", role: "family", k: "secret" }).success).toBe(false);
    expect(CreateCircleSchema.safeParse({ content, consents }).success).toBe(true);
    expect(CreateCircleSchema.safeParse({ content, consents, circleKeyWrapped: WORDS_WRAPPED }).success).toBe(false);
    expect(CreateCircleSchema.safeParse({ content, consents, phrase: WORDS }).success).toBe(false);
    const key = "A".repeat(43);
    expect(HandOverCircleKeySchema.safeParse({ circleId, key, keyVersion: 1 }).success).toBe(true);
    expect(HandOverCircleKeySchema.safeParse({ circleId, key, keyVersion: 1, words: WORDS }).success).toBe(false);
    expect(HandOverCircleKeySchema.safeParse({ circleId, key: WORDS, keyVersion: 1 }).success).toBe(false);
    expect(HandOverCircleKeySchema.safeParse({ circleId, key: "short", keyVersion: 1 }).success).toBe(false);
  });
});
