import { NextResponse, type NextRequest } from "next/server";

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

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (query.length < 2 || query.length > 60) return NextResponse.json({ names: [] });
  let list: string[] = [];
  try {
    list = await names();
  } catch {
    list = cached?.names ?? [];
  }
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of list) {
    const lower = name.toLowerCase();
    if (lower.startsWith(query)) starts.push(name);
    else if (contains.length < 8 && lower.includes(query)) contains.push(name);
    if (starts.length >= 8) break;
  }
  const result = [...starts, ...contains].slice(0, 8).map((name) => (name === name.toUpperCase() || name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : name));
  return NextResponse.json({ names: result }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
