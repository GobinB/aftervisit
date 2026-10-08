import { describe, expect, test, vi } from "vitest";
import type { HandoffRow } from "@/lib/db";
import { inviteView, normalizeSections, type RecipientRow, type TaskStatusRow } from "@/lib/invites";
import { sampleDraft } from "@/lib/sample";
import { HandoffPayloadSchema, RecipientShareSchema, SHARE_SECTIONS, type ShareSection } from "@/lib/schema";

vi.mock("server-only", () => ({}));

describe("recipient section permissions", () => {
  test("omitted sections use defaults, but an explicit empty selection stays empty", () => {
    const omitted = RecipientShareSchema.parse({ name: "Rosa", role: "home_aide" });
    const empty = RecipientShareSchema.parse({ name: "Rosa", role: "home_aide", sections: [] });
    expect(normalizeSections(omitted.sections)).toEqual(SHARE_SECTIONS);
    expect(normalizeSections(empty.sections)).toEqual([]);
    expect(normalizeSections(["watchFor", "medications", "watchFor"])).toEqual(["medications", "watchFor"]);
  });

  test.each<{ label: string; sections: ShareSection[] }>([
    { label: "no sections", sections: [] },
    { label: "medications and warnings only", sections: ["medications", "watchFor"] },
  ])("filters content and task permissions for $label", ({ sections }) => {
    const payload = HandoffPayloadSchema.parse(sampleDraft());
    payload.otherNotes = ["Private caregiver note"];
    const row: HandoffRow = {
      token: "private-handoff-token", manage_key_hash: "private-manage-hash", pin_hash: null,
      pin_failures: 0, locked_until: null, payload, source_text: null,
      original_path: "private/sample.pdf", created_by: "Gobin", recipients: [], acks: [],
      created_at: "2026-10-01T00:00:00Z", expires_at: "2026-11-01T00:00:00Z", access_mode: "invite",
    };
    const recipient: RecipientRow = {
      id: "recipient-id", handoff_token: row.token, name: "Rosa", role: "home_aide",
      invite_hash: "private-invite-hash", sections: normalizeSections([...sections]), tasks_scope: "all",
      created_at: row.created_at, revoked_at: null, first_opened_at: null, last_opened_at: null, acked_at: null,
    };
    const statuses: TaskStatusRow[] = payload.tasks.map((task) => ({
      handoff_token: row.token, task_id: task.id, assignee_id: recipient.id, status: "completed",
      note: "Private task note", updated_at: row.created_at, updated_by_id: recipient.id,
      updated_by_name: recipient.name, updated_via: "personal_link", completed_at: row.created_at,
    }));
    const view = inviteView(row, recipient, statuses);
    expect(view.payload.medications).toEqual(sections.length ? payload.medications : []);
    expect(view.payload.watchFor).toEqual(sections.length ? payload.watchFor : []);
    expect(view.payload.tasks).toEqual([]);
    expect(view.payload.otherNotes).toEqual([]);
    expect(view.payload.questions).toEqual([]);
    expect(view.payload.visit.summary).toBe("");
    expect(view.payload.visit.reason).toBeUndefined();
    expect(view.hasOriginal).toBe(false);
    expect(view.invite?.taskStatus).toEqual({});
    expect(view.invite?.canUpdate).toEqual([]);
    expect(view.token).toBe("");
    expect(JSON.stringify(view)).not.toMatch(/Private|private-/);
  });
});
