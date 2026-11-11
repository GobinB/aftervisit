import { describe, expect, test } from "vitest";
import { generateCircleKey, generateFileKey, rewrapFileKeys, unwrapCircleKey, unwrapFileKey, wrapCircleKey, wrapFileKey } from "@/lib/crypto/keys";
import { openPage, sealPage } from "@/lib/crypto/pages";
import { CreateDocumentSchema, fileKind, FileKeyRewrapSchema, SEALED_PAGE_OVERHEAD } from "@/lib/schema/documents";

const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const DOC = "55555555-5555-4555-8555-555555555555";
const OTHER_DOC = "66666666-6666-4666-8666-666666666666";
/** A fictional page: JPEG's first bytes, then text a reader of the stored bytes must never find. */
const MARKER = "Maplewood Family Clinic metformin 500 mg";
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(MARKER.repeat(40))]);

const contains = (haystack: Uint8Array, needle: string) => Buffer.from(haystack).includes(Buffer.from(needle));

describe("encrypted visit summary pages", () => {
  test("what is uploaded is not the photo, and only the key opens it", async () => {
    const circleKey = await generateCircleKey();
    const fileKey = await generateFileKey();
    const stored = await wrapFileKey(fileKey, circleKey, 1);
    // What the server is given to store alongside the pages.
    expect(CreateDocumentSchema.safeParse({ circleId: OTHER_DOC, kind: "photos", pageCount: 1, ...stored }).success).toBe(true);

    const sealed = await sealPage(PHOTO, fileKey, DOC, 1);
    expect(sealed.length).toBe(PHOTO.length + SEALED_PAGE_OVERHEAD);
    expect(fileKind(sealed)).toBeNull();
    expect(contains(sealed, "Maplewood")).toBe(false);
    expect(contains(sealed, "metformin")).toBe(false);

    // The caregiver's device: circle key -> file key -> page.
    const opened = await openPage(sealed, await unwrapFileKey(stored, circleKey), DOC, 1);
    expect(opened).toEqual(PHOTO);

    // Anyone without the circle key (the server, the database owner) cannot open the file key.
    await expect(unwrapFileKey(stored, await generateCircleKey())).rejects.toThrow();
    await expect(openPage(sealed, await generateFileKey(), DOC, 1)).rejects.toThrow();
  });

  test("the same page encrypts differently each time", async () => {
    const fileKey = await generateFileKey();
    const a = await sealPage(PHOTO, fileKey, DOC, 1);
    const b = await sealPage(PHOTO, fileKey, DOC, 1);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  test("a page that was changed, moved or swapped does not open", async () => {
    const fileKey = await generateFileKey();
    const sealed = await sealPage(PHOTO, fileKey, DOC, 1);
    const changed = sealed.slice();
    changed[40] ^= 1;
    await expect(openPage(changed, fileKey, DOC, 1)).rejects.toThrow();
    await expect(openPage(sealed, fileKey, DOC, 2)).rejects.toThrow();
    await expect(openPage(sealed, fileKey, OTHER_DOC, 1)).rejects.toThrow();
    await expect(openPage(sealed.slice(0, 20), fileKey, DOC, 1)).rejects.toThrow();
  });

  test("the recovery words bring the pages back on a new device", async () => {
    const circleKey = await generateCircleKey();
    const wrappedCircleKey = await wrapCircleKey(circleKey, PHRASE);
    const fileKey = await generateFileKey();
    const stored = await wrapFileKey(fileKey, circleKey, 1);
    const sealed = await sealPage(PHOTO, fileKey, DOC, 1);

    const restored = await unwrapCircleKey(wrappedCircleKey, PHRASE);
    expect(await openPage(sealed, await unwrapFileKey(stored, restored), DOC, 1)).toEqual(PHOTO);
  });

  test("after the circle key changes, saved pages open with the new key and not the old one", async () => {
    const previous = await generateCircleKey();
    const next = await generateCircleKey();
    const fileKey = await generateFileKey();
    const stored = await wrapFileKey(fileKey, previous, 1);
    const sealed = await sealPage(PHOTO, fileKey, DOC, 1);

    const [rewrapped] = await rewrapFileKeys([stored], previous, next, 2);
    expect(rewrapped.keyVersion).toBe(2);
    expect(FileKeyRewrapSchema.safeParse({ id: DOC, fileKeyWrapped: rewrapped.fileKeyWrapped, fileKeyIv: rewrapped.fileKeyIv }).success).toBe(true);
    expect(await openPage(sealed, await unwrapFileKey(rewrapped, next), DOC, 1)).toEqual(PHOTO);
    await expect(unwrapFileKey(rewrapped, previous)).rejects.toThrow();
  });
});
