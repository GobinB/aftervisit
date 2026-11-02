import { describe, expect, test } from "vitest";
import { buildHelperLink, helperLinkForServer, parseLinkKey } from "@/lib/crypto/link";
import { decryptFile, encryptFile, exportKeyBytes, generateCircleKey, generateFileKey, rewrapFileKeys, unwrapCircleKey, unwrapFileKey, wrapCircleKey, wrapFileKey } from "@/lib/crypto/keys";
import { confirmationIndexes, generatePhrase, phraseEntropy } from "@/lib/crypto/phrase";
import { AddMemberSchema, CreateCircleSchema, OpenMemberLinkSchema, RotateCircleKeySchema, WRAPPED_CIRCLE_KEY } from "@/lib/schema/circles";

const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const OTHER = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const TOKEN = "abcdefghijklmnopqrstuvwx";

describe("circle keys", () => {
  test("a 12-word phrase matches the BIP39 test vector", async () => {
    expect(await generatePhrase(new Uint8Array(16))).toBe(PHRASE);
    const entropy = new Uint8Array(16).fill(0x7f);
    expect(await generatePhrase(entropy)).toBe(OTHER);
    expect(await phraseEntropy(PHRASE)).toEqual(new Uint8Array(16));
    expect(await phraseEntropy("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zoo")).toBeNull();
  });

  test("wrap and unwrap round-trip, and the wrong phrase fails", async () => {
    const key = await generateCircleKey();
    const wrapped = await wrapCircleKey(key, PHRASE);
    expect(WRAPPED_CIRCLE_KEY.test(wrapped)).toBe(true);
    expect(wrapped).not.toContain("abandon");
    const opened = await unwrapCircleKey(wrapped, `  ${PHRASE.toUpperCase()}  `);
    expect(await exportKeyBytes(opened)).toEqual(await exportKeyBytes(key));
    await expect(unwrapCircleKey(wrapped, OTHER)).rejects.toThrow(/did not open/);
    await expect(unwrapCircleKey(wrapped, "not a real phrase")).rejects.toThrow(/not a recovery phrase/);
  });

  test("a file encrypts and decrypts, including after the circle key changes", async () => {
    const circle = await generateCircleKey();
    const next = await generateCircleKey();
    const fileKey = await generateFileKey();
    const plain = new TextEncoder().encode("Riverbend Pharmacy hours");
    const encrypted = await encryptFile(plain, fileKey);
    const stored = await wrapFileKey(fileKey, circle, 1);
    const opened = await unwrapFileKey(stored, circle);
    expect(await decryptFile(encrypted.ciphertext, encrypted.iv, opened)).toEqual(plain);
    await expect(exportKeyBytes(opened)).rejects.toThrow();
    const rewrapped = await rewrapFileKeys([stored], circle, next, 2);
    expect(rewrapped[0]?.keyVersion).toBe(2);
    const again = await unwrapFileKey(rewrapped[0]!, next);
    expect(await decryptFile(encrypted.ciphertext, encrypted.iv, again)).toEqual(plain);
  });

  test("confirmation asks for three different words", () => {
    const indexes = confirmationIndexes(12, (() => {
      const values = [3, 3, 7, 10];
      return () => values.shift() ?? 0;
    })());
    expect(indexes).toEqual([3, 7, 10]);
  });
});

describe("helper links", () => {
  test("the key is only in the hash", async () => {
    const raw = await exportKeyBytes(await generateCircleKey());
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

  test("server actions accept a token and reject a key or a phrase", () => {
    const wrapped = `av1.600000.${"a".repeat(22)}.${"b".repeat(16)}.${"c".repeat(64)}`;
    expect(OpenMemberLinkSchema.safeParse({ token: TOKEN, pin: "1234" }).success).toBe(true);
    expect(OpenMemberLinkSchema.safeParse({ token: TOKEN, k: "secret" }).success).toBe(false);
    expect(AddMemberSchema.safeParse({ circleId: "22222222-2222-4222-8222-222222222222", name: "Rosa", role: "family", k: "secret" }).success).toBe(false);
    expect(CreateCircleSchema.safeParse({
      content: { person_name: "Margaret Ward" },
      consents: { authorized_to_share: true, terms: true, privacy: true },
      circleKeyWrapped: wrapped,
      keyVersion: 1,
      phrase: PHRASE,
    }).success).toBe(false);
    expect(RotateCircleKeySchema.safeParse({
      circleId: "22222222-2222-4222-8222-222222222222",
      circleKeyWrapped: wrapped,
      keyVersion: 2,
      phrase: PHRASE,
    }).success).toBe(false);
  });
});
