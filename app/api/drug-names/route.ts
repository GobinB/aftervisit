import { NextResponse, type NextRequest } from "next/server";
import { rankDrugNames } from "@/lib/drug-names";

/**
 * Medication name suggestions from the U.S. National Library of Medicine's RxNorm list.
 * The server downloads the whole public list (about 28,000 names) once a day and filters it here,
 * so what a caregiver types never leaves this site.
 */
const SOURCE = "https://rxnav.nlm.nih.gov/REST/displaynames.json";
const DAY_SECONDS = 24 * 60 * 60;

let cached: { at: number; names: string[] } | null = null;

async function names(): Promise<string[]> {
  if (cached && Date.now() - cached.at < DAY_SECONDS * 1000) return cached.names;
  const response = await fetch(SOURCE, { next: { revalidate: DAY_SECONDS } });
  if (!response.ok) return cached?.names ?? [];
  const body = (await response.json()) as { displayTermsList?: { term?: string[] } };
  const list = body.displayTermsList?.term ?? [];
  cached = { at: Date.now(), names: list };
  return list;
}

/** POST, so what was typed travels in the body and never lands in request logs as part of a URL. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { q?: unknown } | null;
  const query = (typeof body?.q === "string" ? body.q : "").trim().toLowerCase();
  if (query.length < 2 || query.length > 60) return NextResponse.json({ names: [] });
  let list: string[] = [];
  try {
    list = await names();
  } catch {
    list = cached?.names ?? [];
  }
  const result = rankDrugNames(list, query);
  return NextResponse.json({ names: result }, { headers: { "Cache-Control": "no-store" } });
}
