import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import { documentTitle, fileKind } from "@/lib/schema/documents";

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
    expect((await createDocument(helper, { circleId, kind: "photos", pageCount: 2 })).ok).toBe(false);
    expect(await readPage(helper, circleId, docId, 1)).toBeNull();
    expect((await deleteDocument(stranger, circleId, docId)).ok).toBe(false);
    expect(clientFor).not.toHaveBeenCalled();
    expect(serviceClient).not.toHaveBeenCalled();
  });

  test("pages are kept in order, as the right kind of file", async () => {
    const row = { id: docId, circle_id: circleId, visit_date: null, clinic: null, kind: "photos", page_count: 2, paths: [], created_at: "2026-11-06T10:00:00Z" };
    const updates: unknown[] = [];
    clientFor.mockReturnValue(rowClient(row, updates));
    const upload = vi.fn(async () => ({ error: null }));
    serviceClient.mockReturnValue({ storage: { from: () => ({ upload, remove: vi.fn() }) } });

    expect(await addPage(owner, circleId, docId, 2, JPEG)).toMatchObject({ ok: false, status: 409 });
    expect(await addPage(owner, circleId, docId, 1, PDF)).toMatchObject({ ok: false, status: 415 });
    expect(upload).not.toHaveBeenCalled();

    expect(await addPage(owner, circleId, docId, 1, JPEG)).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledWith(`${circleId}/${docId}/1.jpg`, JPEG, expect.objectContaining({ contentType: "image/jpeg", upsert: false }));
    expect(updates).toEqual([{ paths: [`${circleId}/${docId}/1.jpg`] }]);
  });

  test("a summary from another circle is not found", async () => {
    clientFor.mockReturnValue(rowClient(null));
    expect(await addPage(owner, circleId, docId, 1, JPEG)).toMatchObject({ ok: false, status: 404 });
  });
});
