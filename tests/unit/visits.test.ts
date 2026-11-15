import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import type { HelperRole, Visibility } from "@/lib/schema/circles";
import { VisitContentSchema, VisitUpdateSchema, hasNotes, sortVisits, viewOfVisit, visitLabel, visitLines } from "@/lib/schema/visits";

const { clientFor } = vi.hoisted(() => ({ clientFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/store/db", () => ({ clientFor }));

import { deleteVisit, getVisit, listVisits, updateVisit } from "@/services/visits";

const circleId = "22222222-2222-4222-8222-222222222222";
const visitId = "55555555-5555-4555-8555-555555555501";
const owner: Actor = { kind: "caregiver", userId: "user-owner", circleIds: [circleId], role: "owner", accessToken: "token" };
const helper = (role: HelperRole, visibility: Visibility = {}): Actor => ({ kind: "helper", memberId: "33333333-3333-4333-8333-333333333301", circleId, role, visibility });

const content = {
  clinic: "Riverbend Clinic",
  provider: "Dr. Anita Patel",
  reason: "Dizziness when standing",
  summary: "Blood pressure is still high. The dose was raised.",
  watchFor: ["Any fall", "Swelling of the lips or face"],
  goodToKnow: ["Avoid caffeine after noon"],
  questions: ["Should Margaret start vitamin D?"],
};
const rows = [
  { id: visitId, visit_date: "2026-11-04", created_at: "2026-11-05T10:00:00Z", content },
  { id: "55555555-5555-4555-8555-555555555502", visit_date: "2026-11-10", created_at: "2026-11-10T09:00:00Z", content: { summary: "", watchFor: [], goodToKnow: [], questions: [] } },
];

/** A stand-in for the database client: remembers what was asked and answers with the rows above. */
function fakeDb(data: unknown[] = rows) {
  const calls: { table: string; op: string; row?: unknown; eqs: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, op: "select", row: undefined as unknown, eqs: [] as [string, unknown][] };
      calls.push(call);
      const answer = () => (table === "visits" ? data.filter((row) => call.eqs.every(([column, value]) => column === "circle_id" || (row as Record<string, unknown>)[column] === value)) : []);
      const chain = {
        select: () => chain,
        update: (row: unknown) => ((call.op = "update"), (call.row = row), chain),
        delete: () => ((call.op = "delete"), chain),
        eq: (column: string, value: unknown) => (call.eqs.push([column, value]), chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: answer()[0] ?? null, error: null }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: answer(), error: null }).then(resolve),
      };
      return chain;
    },
  };
  clientFor.mockReturnValue(client);
  return calls;
}

beforeEach(() => clientFor.mockReset());

describe("visit notes: what is kept", () => {
  test("the content keeps the summary and the three lists, and nothing else", () => {
    expect(VisitContentSchema.parse({ summary: " Seen for dizziness. ", watchFor: ["Any fall "] })).toMatchObject({
      summary: "Seen for dizziness.",
      watchFor: ["Any fall"],
      goodToKnow: [],
      questions: [],
    });
    expect(VisitContentSchema.safeParse({ summary: "", medications: [] }).success).toBe(false);
    expect(VisitContentSchema.safeParse({ summary: "", watchFor: Array.from({ length: 41 }, (_, i) => `line ${i}`) }).success).toBe(false);
    expect(VisitContentSchema.safeParse({ summary: "", watchFor: [""] }).success).toBe(false);
  });

  test("lines from the review are trimmed, with blanks and repeats left out", () => {
    expect(visitLines(["Any fall", " any fall ", "", "Fainting"])).toEqual(["Any fall", "Fainting"]);
    expect(visitLines(Array.from({ length: 60 }, (_, i) => `line ${i}`))).toHaveLength(40);
  });

  test("a fix must name its circle and visit, and may clear the date", () => {
    expect(VisitUpdateSchema.safeParse({ circleId, id: visitId, visitDate: "", content: { summary: "ok" } }).success).toBe(true);
    expect(VisitUpdateSchema.safeParse({ circleId, id: "nope", content: { summary: "ok" } }).success).toBe(false);
  });

  test("the newest visit comes first, by the day it happened", () => {
    const sorted = sortVisits([
      { id: "a", visitDate: "2026-11-04", createdAt: "2026-11-12T00:00:00Z" },
      { id: "b", visitDate: null, createdAt: "2026-11-08T00:00:00Z" },
      { id: "c", visitDate: "2026-11-10", createdAt: "2026-11-10T00:00:00Z" },
    ]);
    expect(sorted.map((visit) => visit.id)).toEqual(["c", "b", "a"]);
  });

  test("a visit is named by its day and clinic", () => {
    expect(visitLabel({ visitDate: "2026-11-04", createdAt: "2026-11-05T10:00:00Z", clinic: "Riverbend Clinic" })).toBe("Nov 4 visit · Riverbend Clinic");
    expect(visitLabel({ visitDate: null, createdAt: "2026-11-05T10:00:00Z", provider: "Dr. Patel" })).toBe("Nov 5 visit · Dr. Patel");
  });
});

describe("visit notes: who sees what", () => {
  const row = { id: visitId, visitDate: "2026-11-04", createdAt: "2026-11-05T10:00:00Z", content: VisitContentSchema.parse(content) };

  test("the summary, the reason and the questions are left out of a cut-down view, not blanked", () => {
    const cut = viewOfVisit(row, false);
    expect(cut.watchFor).toEqual(content.watchFor);
    expect(cut.goodToKnow).toEqual(content.goodToKnow);
    expect("summary" in cut).toBe(false);
    expect("questions" in cut).toBe(false);
    expect("reason" in cut).toBe(false);
    expect(JSON.stringify(cut)).not.toContain("vitamin D");
    expect(JSON.stringify(cut)).not.toContain("Blood pressure is still high");
    const full = viewOfVisit(row, true);
    expect(full).toMatchObject({ summary: content.summary, questions: content.questions, reason: content.reason });
  });

  test("the caregiver, family and a care manager get everything", async () => {
    for (const actor of [owner, helper("family"), helper("care_manager")]) {
      fakeDb();
      const visits = await listVisits(actor, circleId);
      expect(visits?.[1]).toMatchObject({ id: visitId, summary: content.summary, questions: content.questions, watchFor: content.watchFor });
    }
  });

  test("a home aide and a day program get what to watch for and good to know, and nothing more", async () => {
    for (const role of ["home_aide", "day_program"] as const) {
      fakeDb();
      const visits = await listVisits(helper(role), circleId);
      const visit = visits?.find((item) => item.id === visitId);
      expect(visit).toMatchObject({ watchFor: content.watchFor, goodToKnow: content.goodToKnow, clinic: "Riverbend Clinic" });
      expect(visit && "summary" in visit).toBe(false);
      expect(visit && "questions" in visit).toBe(false);
      const one = await getVisit(helper(role), circleId, visitId);
      expect(one && "summary" in one).toBe(false);
      expect(one && "documentId" in one).toBe(false);
    }
  });

  test("a person the caregiver hid visit notes from gets nothing, and the database is not asked", async () => {
    fakeDb();
    expect(await listVisits(helper("family", { hidden: ["handoff"] }), circleId)).toBeNull();
    expect(await getVisit(helper("home_aide", { hidden: ["handoff"] }), circleId, visitId)).toBeNull();
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("a person on another circle gets nothing", async () => {
    fakeDb();
    const other: Actor = { ...helper("family"), circleId: "99999999-9999-4999-8999-999999999999" } as Actor;
    expect(await listVisits(other, circleId)).toBeNull();
    expect(clientFor).not.toHaveBeenCalled();
  });

  test("Today shows the newest visit that has something for this viewer", async () => {
    fakeDb();
    const visits = (await listVisits(helper("home_aide"), circleId)) ?? [];
    // The Nov 10 visit has no notes, so the Nov 4 one is shown.
    expect(visits.map((visit) => visit.id)).toEqual([rows[1].id, visitId]);
    expect(visits.find(hasNotes)?.id).toBe(visitId);
  });

  test("only the caregiver sees the photos kept with a visit", async () => {
    fakeDb();
    expect(await getVisit(owner, circleId, visitId)).toHaveProperty("documentId", null);
    fakeDb();
    expect(await getVisit(helper("family"), circleId, visitId)).not.toHaveProperty("documentId");
  });

  test("only the caregiver can change or delete the notes, and a helper never reaches the database", async () => {
    const input = VisitUpdateSchema.parse({ circleId, id: visitId, visitDate: "2026-11-04", content: { summary: "Fixed.", watchFor: ["Any fall"] } });
    for (const role of ["family", "care_manager", "home_aide", "day_program"] as const) {
      fakeDb();
      expect((await updateVisit(helper(role), input)).ok).toBe(false);
      expect((await deleteVisit(helper(role), circleId, visitId)).ok).toBe(false);
      expect(clientFor).not.toHaveBeenCalled();
    }
    const calls = fakeDb();
    expect(await updateVisit(owner, input)).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ table: "visits", op: "update", row: { visit_date: "2026-11-04", content: { summary: "Fixed.", watchFor: ["Any fall"] } } });
    expect(calls[0].eqs).toEqual(expect.arrayContaining([["circle_id", circleId], ["id", visitId]]));
    const removed = fakeDb();
    expect(await deleteVisit(owner, circleId, visitId)).toEqual({ ok: true });
    expect(removed[0]).toMatchObject({ table: "visits", op: "delete" });
    expect(removed[0].eqs).toEqual(expect.arrayContaining([["circle_id", circleId], ["id", visitId]]));
  });
});
