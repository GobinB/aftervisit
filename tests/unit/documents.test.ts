import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { CreateDocumentSchema, documentTitle, fileKind } from "@/lib/schema/documents";

const { clientFor, serviceClient } = vi.hoisted(() => ({ clientFor: vi.fn(), serviceClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor, serviceClient }));

import { addPage, createDocument, deleteDocument, listDocuments, readPage } from "@/services/documents";

const circleId = "22222222-2222-4222-8222-222222222222";
const docId = "55555555-5555-4555-8555-555555555555";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const stranger: Actor = { kind: "caregiver", userId: "user-other", circleIds: [], role: null, accessToken: "token" };
const helper: Actor = { kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role: "family", visibility: {} };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const KEY = { keyVersion: 1, fileKeyWrapped: "A".repeat(64), fileKeyIv: "C".repeat(16) };
/** Long enough to be a page: an IV, some ciphertext and a tag. Random-looking bytes, as ciphertext is. */
const SEALED = Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) % 251);
const JPEG_PAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(60).fill(7)]);
const PDF_PAGE = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(60).fill(7)]);
const ROW = {
  id: docId,
  circle_id: circleId,
  visit_date: null,
  clinic: null,
  kind: "photos",
  page_count: 2,
  paths: [] as string[],
  created_at: "2026-11-06T10:00:00Z",
  key_version: 1,
  file_key_wrapped: KEY.fileKeyWrapped,
  file_key_iv: KEY.fileKeyIv,
};

function rowClient(row: Record<string, unknown> | null, updates: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  chain.eq = () => chain;
  chain.maybeSingle = async () => ({ data: row, error: null });
  return {
    from: () => ({
      select: () => chain,
      update: (value: unknown) => {
        updates.push(value);
        const done = { eq: () => done, then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
        return done;
      },
    }),
  };
}

beforeEach(() => {
  clientFor.mockReset();
  serviceClient.mockReset();
});

describe("saved visit summaries", () => {
  test("file type comes from the file's own first bytes", () => {
    expect(fileKind(JPEG)).toBe("image/jpeg");
    expect(fileKind(PDF)).toBe("application/pdf");
    expect(fileKind(new TextEncoder().encode("<svg>"))).toBeNull();
    expect(fileKind(new Uint8Array())).toBeNull();
  });

  test("a saved summary is named by its date, clinic and size", () => {
    expect(documentTitle({ visitDate: "2026-11-04", clinic: "Maplewood Family Clinic", kind: "photos", pageCount: 3, createdAt: "2026-11-06T10:00:00Z" })).toBe(
      "Nov 4, 2026 · Maplewood Family Clinic · 3 pages",
    );
    expect(documentTitle({ visitDate: null, clinic: null, kind: "pdf", pageCount: 1, createdAt: "2026-11-06T10:00:00Z" })).toBe("Nov 6, 2026 · PDF");
  });

  test("people with a link and other caregivers get nothing, and nothing is read", async () => {
    expect(await listDocuments(helper, circleId)).toBeNull();
    expect(await listDocuments(stranger, circleId)).toBeNull();
    expect((await createDocument(helper, { circleId, kind: "photos", pageCount: 2, ...KEY })).ok).toBe(false);
    expect(await readPage(helper, circleId, docId, 1)).toBeNull();
    expect((await deleteDocument(stranger, circleId, docId)).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
    expect(serviceClient).not.toHaveBeenCalled();
  });

  test("a summary is only started with its wrapped file key", () => {
    const base = { circleId, kind: "photos" as const, pageCount: 2 };
    expect(CreateDocumentSchema.safeParse(base).success).toBe(false);
    expect(CreateDocumentSchema.safeParse({ ...base, ...KEY }).success).toBe(true);
    expect(CreateDocumentSchema.safeParse({ ...base, ...KEY, fileKeyWrapped: "short" }).success).toBe(false);
    // The raw key is not a field.
    expect(CreateDocumentSchema.safeParse({ ...base, ...KEY, fileKey: "raw" }).success).toBe(false);
  });

  test("encrypted pages are kept in order, and a plain photo or PDF is refused", async () => {
    const updates: unknown[] = [];
    clientFor.mockReturnValue(rowClient(ROW, updates));
    const upload = vi.fn(async () => ({ error: null }));
    serviceClient.mockReturnValue({ storage: { from: () => ({ upload, remove: vi.fn() }) } });

    expect(await addPage(owner, circleId, docId, 2, SEALED)).toMatchObject({ ok: false, status: 409 });
    expect(await addPage(owner, circleId, docId, 1, JPEG_PAGE)).toMatchObject({ ok: false, status: 415 });
    expect(await addPage(owner, circleId, docId, 1, PDF_PAGE)).toMatchObject({ ok: false, status: 415 });
    expect(await addPage(owner, circleId, docId, 1, new Uint8Array(28))).toMatchObject({ ok: false, status: 413 });
    expect(upload).not.toHaveBeenCalled();

    expect(await addPage(owner, circleId, docId, 1, SEALED)).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledWith(`${circleId}/${docId}/1.enc`, SEALED, expect.objectContaining({ contentType: "application/octet-stream", upsert: false }));
    expect(updates).toEqual([{ paths: [`${circleId}/${docId}/1.enc`] }]);
  });

  test("a summary saved before encryption takes no more pages", async () => {
    clientFor.mockReturnValue(rowClient({ ...ROW, key_version: null, file_key_wrapped: null, file_key_iv: null }));
    const upload = vi.fn(async () => ({ error: null }));
    serviceClient.mockReturnValue({ storage: { from: () => ({ upload, remove: vi.fn() }) } });
    expect(await addPage(owner, circleId, docId, 1, JPEG_PAGE)).toMatchObject({ ok: false, status: 409 });
    expect(upload).not.toHaveBeenCalled();
  });

  test("an encrypted page is handed back still encrypted", async () => {
    clientFor.mockReturnValue(rowClient({ ...ROW, paths: [`${circleId}/${docId}/1.enc`] }));
    serviceClient.mockReturnValue({ storage: { from: () => ({ download: async () => ({ data: new Blob([SEALED.buffer as ArrayBuffer]), error: null }) }) } });
    const page = await readPage(owner, circleId, docId, 1);
    expect(page).toMatchObject({ type: "application/octet-stream", sealed: true });
    expect(new Uint8Array(page!.bytes)).toEqual(SEALED);
  });

  test("a summary from another circle is not found", async () => {
    clientFor.mockReturnValue(rowClient(null));
    expect(await addPage(owner, circleId, docId, 1, SEALED)).toMatchObject({ ok: false, status: 404 });
  });
});
