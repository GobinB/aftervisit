import { expect, test, type APIRequestContext } from "@playwright/test";
import { sampleDraft, SAMPLE_RECIPIENTS } from "../lib/sample";

const rand = () => Math.floor(Math.random() * 250) + 1;
const ip = () => ({ "x-forwarded-for": `10.${rand()}.${rand()}.${rand()}` });
const inviteOf = (url: string) => new URL(url).pathname.split("/i/")[1];

type Created = { token: string; manageKey: string; invites: { id: string; name: string; url: string }[] };

async function create(request: APIRequestContext, recipients = SAMPLE_RECIPIENTS): Promise<Created> {
  const res = await request.post("/api/handoffs", {
    headers: ip(),
    data: { draft: sampleDraft(), recipients, createdByFirstName: "Gobin", consent: true },
  });
  expect(res.status()).toBe(201);
  return res.json();
}
const byName = (c: Created, name: string) => inviteOf(c.invites.find((i) => i.name === name)!.url);

test.describe("personal invitations (API)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "desktop-chrome", "API-level checks; run once");
  });

  test("each person only receives what was shared with them", async ({ request }) => {
    const c = await create(request, [
      { name: "Lisa", role: "family" },
      { name: "Rosa", role: "home_aide", tasksScope: "mine" },
      { name: "Sunrise Adult Day Health", role: "day_program", sections: ["medications", "watchFor"] },
    ]);
    const get = async (name: string) => (await (await request.get(`/api/invites/${byName(c, name)}`)).json()).handoff;

    const lisa = await get("Lisa");
    expect(lisa.payload.tasks).toHaveLength(5);
    expect(lisa.token).toBe("");
    expect(lisa.recipients).toEqual([]);

    const rosa = await get("Rosa");
    expect(rosa.payload.tasks.map((t: { assignee: string }) => t.assignee)).toEqual(["Rosa", "Rosa"]);

    const sunrise = await get("Sunrise Adult Day Health");
    expect(sunrise.payload.medications.length).toBe(3);
    expect(sunrise.payload.watchFor.length).toBe(4);
    expect(sunrise.payload.tasks).toEqual([]);
    expect(sunrise.payload.questions).toEqual([]);
    expect(sunrise.payload.visit.summary).toBe("");
    expect(JSON.stringify(sunrise)).not.toContain("vitamin D");
  });

  test("a person can update only their own steps; the caregiver can update any", async ({ request }) => {
    const c = await create(request);
    const lisaTask = "task_sample_2";
    const rosaTask = "task_sample_1";
    const as = (name: string, taskId: string, status: string) =>
      request.post(`/api/invites/${byName(c, name)}/tasks`, { headers: ip(), data: { taskId, status, note: "done" } });

    expect((await as("Rosa", lisaTask, "completed")).status()).toBe(403);
    const ok = await as("Lisa", lisaTask, "completed");
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.taskStatus).toMatchObject({ status: "completed", updatedByName: "Lisa", updatedVia: "personal_link" });

    // Manage actions need the manage key.
    expect((await request.post(`/api/handoffs/${c.token}/tasks`, { data: { taskId: rosaTask, status: "in_progress" } })).status()).toBe(403);
    const creator = await request.post(`/api/handoffs/${c.token}/tasks`, {
      headers: { ...ip(), "x-manage-key": c.manageKey },
      data: { taskId: rosaTask, status: "in_progress" },
    });
    expect(creator.status()).toBe(200);
    expect((await creator.json()).taskStatus).toMatchObject({ status: "in_progress", updatedVia: "creator" });
    await request.delete(`/api/handoffs/${c.token}`, { headers: { "x-manage-key": c.manageKey } });
  });

  test("revoking one person leaves everyone else; a new link replaces the old one", async ({ request }) => {
    const c = await create(request);
    const rosa = c.invites.find((i) => i.name === "Rosa")!;
    const manage = { ...ip(), "x-manage-key": c.manageKey };

    expect((await request.post(`/api/handoffs/${c.token}/recipients/${rosa.id}`, { headers: manage, data: { action: "revoke" } })).status()).toBe(200);
    expect((await request.get(`/api/invites/${inviteOf(rosa.url)}`)).status()).toBe(410);
    expect((await request.get(`/api/invites/${byName(c, "Lisa")}`)).status()).toBe(200);

    const fresh = await request.post(`/api/handoffs/${c.token}/recipients/${rosa.id}`, { headers: manage, data: { action: "new_link" } });
    const url = (await fresh.json()).url as string;
    expect((await request.get(`/api/invites/${inviteOf(url)}`)).status()).toBe(200);
    expect((await request.get(`/api/invites/${inviteOf(rosa.url)}`)).status()).toBe(410);

    // Adding a person gives them their own link; steps already assigned to that name become theirs.
    const added = await request.post(`/api/handoffs/${c.token}/recipients`, { headers: manage, data: { name: "Lisa", role: "family" } });
    expect(added.status()).toBe(201);
    await request.delete(`/api/handoffs/${c.token}`, { headers: { "x-manage-key": c.manageKey } });
    expect((await request.get(`/api/invites/${byName(c, "Lisa")}`)).status()).toBe(410);
  });

  test("the general link and general APIs refuse personal-link handoffs", async ({ request }) => {
    const c = await create(request);
    expect((await request.get(`/api/handoffs/${c.token}`)).status()).toBe(404);
    expect((await request.post(`/api/handoffs/${c.token}/ack`, { headers: ip(), data: { name: "Mallory" } })).status()).toBe(404);
    expect((await request.get(`/api/handoffs/${c.token}/original`)).status()).toBe(404);
    expect((await request.get(`/api/invites/AAAAAAAAAAAAAAAAAAAAAAAA`)).status()).toBe(404);
    await request.delete(`/api/handoffs/${c.token}`, { headers: { "x-manage-key": c.manageKey } });
  });

  test("feedback is anonymous and needs consent", async ({ request }) => {
    expect((await request.post("/api/feedback", { headers: ip(), data: { context: "demo", easier: "yes" } })).status()).toBe(400);
    expect((await request.post("/api/feedback", { headers: ip(), data: { context: "demo", consent: true } })).status()).toBe(400);
    const ok = await request.post("/api/feedback", { headers: ip(), data: { context: "demo", easier: "yes", whoElse: "the pharmacist", consent: true } });
    expect(ok.status()).toBe(201);
  });
});
