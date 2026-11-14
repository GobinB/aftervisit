import { describe, expect, test } from "vitest";
import { generateFileKey, importCircleKey, unwrapFileKey, wrapFileKey } from "@/lib/crypto/keys";
import { openPage, sealPage } from "@/lib/crypto/pages";
import { CreateDocumentSchema, fileKind, SEALED_PAGE_OVERHEAD } from "@/lib/schema/documents";

const generateCircleKey = () => importCircleKey(crypto.getRandomValues(new Uint8Array(32)));
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

    // Without the circle key (a copy of the database, or of file storage), the file key does not open.
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
});
