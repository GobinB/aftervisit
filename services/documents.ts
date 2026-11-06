import "server-only";
import type { Actor } from "@/lib/auth";
import { fileKind, MAX_PAGE_BYTES, type CreateDocumentInput, type VisitDocument } from "@/lib/schema/documents";
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
};

const COLUMNS = "id, circle_id, visit_date, clinic, kind, page_count, paths, created_at";

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
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "The summary could not be kept. Try again." };
  return { ok: true, id: data.id as string };
}

/**
 * Stores one page (a JPEG) or the PDF, at {circle}/{document}/{n}. The type is read from the file's
 * own bytes. Pages are added in order; a page number that is already saved is refused.
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
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PAGE_BYTES) return { ok: false, error: "That page is too large to keep.", status: 413 };
  const type = fileKind(bytes);
  const wanted = row.kind === "pdf" ? "application/pdf" : "image/jpeg";
  if (type !== wanted) return { ok: false, error: "That file could not be kept.", status: 415 };
  if (page !== row.paths.length + 1 || page > row.page_count) return { ok: false, error: "Pages are kept in order.", status: 409 };
  const path = `${circleId}/${id}/${page}.${type === "application/pdf" ? "pdf" : "jpg"}`;
  const { error: upload } = await serviceClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false, cacheControl: "0" });
  if (upload) return { ok: false, error: "That page could not be kept. Try again.", status: 500 };
  const { error } = await clientFor(actor).from("visit_documents").update({ paths: [...row.paths, path] }).eq("circle_id", circleId).eq("id", id);
  if (error) {
    await serviceClient().storage.from(DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, error: "That page could not be kept. Try again.", status: 500 };
  }
  return { ok: true };
}

/** One saved page's bytes, for the caregiver only. */
export async function readPage(actor: Actor, circleId: string, id: string, page: number): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const row = await ownRow(actor, circleId, id);
  const path = row?.paths[page - 1];
  if (!row || !path) return null;
  const { data, error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), type: row.kind === "pdf" ? "application/pdf" : "image/jpeg" };
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
