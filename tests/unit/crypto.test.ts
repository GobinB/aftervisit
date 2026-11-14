import { describe, expect, test } from "vitest";
import { buildHelperLink, helperLinkForServer, parseLinkKey } from "@/lib/crypto/link";
import { decryptFile, encryptFile, exportKeyBytes, generateFileKey, importCircleKey, unwrapFileKey, wrapFileKey } from "@/lib/crypto/keys";
import { AddMemberSchema, CreateCircleSchema, HELD_CIRCLE_KEY, OpenMemberLinkSchema } from "@/lib/schema/circles";

const WORDS = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const WORDS_WRAPPED = "av1.600000.BwcHBwcHBwcHBwcHBwcHBw.CQkJCQkJCQkJCQkJ.HjJDlfueDE80z1civaCUlcv2-xAJhJ3UwUMvgeL9stWx0Brhvb0uniVV013hsgWZ";
const TOKEN = "abcdefghijklmnopqrstuvwx";

const randomCircleKey = () => importCircleKey(crypto.getRandomValues(new Uint8Array(32)));

describe("the stored form of a circle key", () => {
  test("only the held form is accepted", () => {
    expect(HELD_CIRCLE_KEY.test(`av2.${"a".repeat(16)}.${"b".repeat(64)}`)).toBe(true);
    expect(HELD_CIRCLE_KEY.test(WORDS_WRAPPED)).toBe(false);
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
  });
});
