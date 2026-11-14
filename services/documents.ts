import "server-only";
import type { Actor } from "@/lib/auth";
import { fileKind, MAX_SEALED_PAGE_BYTES, SEALED_PAGE_OVERHEAD, type CreateDocumentInput, type StoredDocumentKey, type VisitDocument } from "@/lib/schema/documents";
import { clientFor, serviceClient } from "@/store/db";

export const DOCUMENTS_BUCKET = "visit-documents";

type Row = {
  id: string;
  circle_id: string;
  visit_date: string | null;
  clinic: string | null;
  kind: "photos" | "pdf";
  page_count: number;
  paths: string[];
  created_at: string;
  key_version: number | null;
  file_key_wrapped: string | null;
  file_key_iv: string | null;
};

const COLUMNS = "id, circle_id, visit_date, clinic, kind, page_count, paths, created_at, key_version, file_key_wrapped, file_key_iv";

function fileKeyOf(row: Row): StoredDocumentKey | null {
  if (!row.file_key_wrapped || !row.file_key_iv || row.key_version == null) return null;
  return { fileKeyWrapped: row.file_key_wrapped, fileKeyIv: row.file_key_iv, keyVersion: row.key_version };
}

function toDocument(row: Row): VisitDocument {
  return {
    id: row.id,
    circleId: row.circle_id,
    visitDate: row.visit_date,
    clinic: row.clinic,
    kind: row.kind,
    pageCount: row.page_count,
    saved: row.paths.length,
    createdAt: row.created_at,
    fileKey: fileKeyOf(row),
  };
}

/** Saved summaries are the caregiver's alone. Row security checks the same thing again. */
function isCaregiver(actor: Actor, circleId: string): actor is Extract<Actor, { kind: "caregiver" }> {
  return actor.kind === "caregiver" && actor.circleIds.includes(circleId);
}

/** The row, read as the caregiver, so a document in another circle is simply not found. */
async function ownRow(actor: Actor, circleId: string, id: string): Promise<Row | null> {
  if (!isCaregiver(actor, circleId)) return null;
  const { data, error } = await clientFor(actor).from("visit_documents").select(COLUMNS).eq("circle_id", circleId).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

export async function listDocuments(actor: Actor, circleId: string, limit = 100): Promise<VisitDocument[] | null> {
  if (!isCaregiver(actor, circleId)) return null;
  const { data, error } = await clientFor(actor)
    .from("visit_documents")
    .select(COLUMNS)
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Row[]).filter((row) => row.paths.length > 0).map(toDocument);
}

export async function getDocument(actor: Actor, circleId: string, id: string): Promise<VisitDocument | null> {
  const row = await ownRow(actor, circleId, id);
  return row ? toDocument(row) : null;
}

export async function createDocument(actor: Actor, input: CreateDocumentInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isCaregiver(actor, input.circleId)) return { ok: false, error: "Only the caregiver can keep visit summaries." };
  const { data, error } = await clientFor(actor)
    .from("visit_documents")
    .insert({
      circle_id: input.circleId,
      visit_date: input.visitDate ?? null,
      clinic: input.clinic ?? null,
      kind: input.kind,
      page_count: input.pageCount,
      key_version: input.keyVersion,
      file_key_wrapped: input.fileKeyWrapped,
      file_key_iv: input.fileKeyIv,
    })
    .select("id")
    .single();
  if (error && /file key version/i.test(error.message ?? "")) {
    return { ok: false, error: "Something changed on another device while these were being kept. Scan the summary again to keep the photos." };
  }
  if (error || !data) return { ok: false, error: "The summary could not be kept. Try again." };
  return { ok: true, id: data.id as string };
}

/**
 * Stores one encrypted page at {circle}/{document}/{n}.enc. The bytes were encrypted in the caregiver's
 * browser with the summary's file key, so storage only ever holds ciphertext. A plain photo or
 * PDF is refused: its own first bytes give it away. Pages are added in order; a page number that is
 * already saved is refused.
 */
export async function addPage(
  actor: Actor,
  circleId: string,
  id: string,
  page: number,
  bytes: Uint8Array,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await ownRow(actor, circleId, id);
  if (!row) return { ok: false, error: "That summary was not found.", status: 404 };
  if (!fileKeyOf(row)) return { ok: false, error: "That summary cannot take more pages.", status: 409 };
  if (bytes.byteLength <= SEALED_PAGE_OVERHEAD || bytes.byteLength > MAX_SEALED_PAGE_BYTES) return { ok: false, error: "That page is too large to keep.", status: 413 };
  if (fileKind(bytes)) return { ok: false, error: "That page was not locked before it was sent, so it was not kept.", status: 415 };
  if (page !== row.paths.length + 1 || page > row.page_count) return { ok: false, error: "Pages are kept in order.", status: 409 };
  const path = `${circleId}/${id}/${page}.enc`;
  const { error: upload } = await serviceClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: "application/octet-stream", upsert: false, cacheControl: "0" });
  if (upload) return { ok: false, error: "That page could not be kept. Try again.", status: 500 };
  const { error } = await clientFor(actor).from("visit_documents").update({ paths: [...row.paths, path] }).eq("circle_id", circleId).eq("id", id);
  if (error) {
    await serviceClient().storage.from(DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, error: "That page could not be kept. Try again.", status: 500 };
  }
  return { ok: true };
}

/**
 * One saved page's bytes, for the caregiver only. An encrypted page comes back still encrypted
 * (the browser opens it); a page saved before encryption comes back as the photo or PDF it is.
 */
export async function readPage(actor: Actor, circleId: string, id: string, page: number): Promise<{ bytes: ArrayBuffer; type: string; sealed: boolean } | null> {
  const row = await ownRow(actor, circleId, id);
  const path = row?.paths[page - 1];
  if (!row || !path) return null;
  const { data, error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) return null;
  const sealed = fileKeyOf(row) !== null;
  return { bytes: await data.arrayBuffer(), type: sealed ? "application/octet-stream" : row.kind === "pdf" ? "application/pdf" : "image/jpeg", sealed };
}

/** Every encrypted summary's wrapped file key, so a circle key handed over by a device can be checked against them. */
export async function listFileKeys(actor: Actor, circleId: string): Promise<({ id: string } & StoredDocumentKey)[] | null> {
  if (!isCaregiver(actor, circleId)) return null;
  const { data, error } = await clientFor(actor).from("visit_documents").select("id, key_version, file_key_wrapped, file_key_iv").eq("circle_id", circleId).not("file_key_wrapped", "is", null);
  if (error || !data) return null;
  return data.map((row) => ({ id: row.id as string, fileKeyWrapped: row.file_key_wrapped as string, fileKeyIv: row.file_key_iv as string, keyVersion: row.key_version as number }));
}

/** Deletes the files first, then the row, so nothing is left behind that the app cannot reach. */
export async function deleteDocument(actor: Actor, circleId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await ownRow(actor, circleId, id);
  if (!row) return { ok: false, error: "That summary was not found." };
  if (row.paths.length) {
    const { error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).remove(row.paths);
    if (error) return { ok: false, error: "The photos could not be deleted. Try again." };
  }
  const { error } = await clientFor(actor).from("visit_documents").delete().eq("circle_id", circleId).eq("id", id);
  if (error) return { ok: false, error: "The photos could not be deleted. Try again." };
  return { ok: true };
}

/** How many encrypted summaries a circle has. Null when the count could not be read. */
export async function countEncryptedDocuments(actor: Actor, circleId: string): Promise<number | null> {
  if (!isCaregiver(actor, circleId)) return null;
  const { count, error } = await clientFor(actor)
    .from("visit_documents")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId)
    .not("file_key_wrapped", "is", null);
  if (error || count == null) return null;
  return count;
}

/** The storage paths of every encrypted summary in a circle. Null when they could not be read. */
export async function listEncryptedPaths(actor: Actor, circleId: string): Promise<string[] | null> {
  if (!isCaregiver(actor, circleId)) return null;
  const { data, error } = await clientFor(actor).from("visit_documents").select("paths").eq("circle_id", circleId).not("file_key_wrapped", "is", null);
  if (error || !data) return null;
  return data.flatMap((row) => (row.paths as string[]) ?? []);
}

/**
 * Removes stored pages by path. Only for paths that belong to this caregiver's circle: every
 * path starts with the circle's id, and anything else is refused.
 */
export async function removeStoredPages(actor: Actor, circleId: string, paths: string[]): Promise<boolean> {
  if (!isCaregiver(actor, circleId)) return false;
  if (paths.some((path) => !path.startsWith(`${circleId}/`))) return false;
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).remove(paths.slice(i, i + 100));
    if (error) return false;
  }
  return true;
}

/** Removes every saved file of the circles about to be erased. Used by the daily cleanup. */
export async function removeCircleFiles(circleIds: string[]): Promise<number> {
  if (!circleIds.length) return 0;
  const { data } = await serviceClient().from("visit_documents").select("paths").in("circle_id", circleIds);
  const paths = (data ?? []).flatMap((row) => (row.paths as string[]) ?? []);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
  return paths.length;
}
