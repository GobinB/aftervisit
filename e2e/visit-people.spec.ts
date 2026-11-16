import { createHash, createHmac, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";
import { sampleDraft } from "../lib/sample";

/**
 * The last step of a visit: picking who helps with each appointment and reminder, adding someone
 * new right there, and texting each person their part. A fictional caregiver signs in with a
 * password on the test database (the one the app under test uses, from .env.local) and makes a
 * circle the way the app does. Skipped when that database is not set up here. The circle is deleted
 * afterwards.
 */
loadEnvConfig(process.cwd());
const URL_ = process.env.SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const HELPER_SECRET = process.env.HELPER_SESSION_SECRET ?? "";
const SALT = process.env.IP_HASH_SALT ?? "";
const ready = Boolean(URL_ && ANON && SERVICE && HELPER_SECRET);

const tokenFor = (memberId: string) => createHmac("sha256", HELPER_SECRET).update(`ahc-member-link:${memberId}:1`).digest("base64url").slice(0, 24);
const hashOf = (token: string) => createHash("sha256").update([SALT, "invite", token].join(":")).digest("hex");

async function rest(path: string, init: RequestInit = {}, bearer = SERVICE) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: {
      apikey: bearer === SERVICE ? SERVICE : ANON,
      Authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

type Seeded = { circleId: string; ownerToken: string; ownerSession: Record<string, unknown>; joyId: string };

async function seed(): Promise<Seeded | null> {
  const email = `visit-people.${randomUUID()}@example.com`;
  const password = randomUUID();
  await rest("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: "Lena Ortiz" } }) });
  const signIn = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!signIn.ok) return null;
  const ownerSession = (await signIn.json()) as Record<string, unknown>;
  const ownerToken = ownerSession.access_token as string;
  const consents = ["authorized_to_share", "terms", "privacy"].map((type) => ({ type, version: "2026-11-03", text_hash: createHash("sha256").update(type).digest("hex") }));
  const content = { person_name: "Teodora", allergies: [], doctors: [], emergency_contacts: [] };
  const circleId = (await rest("/rest/v1/rpc/create_circle", { method: "POST", body: JSON.stringify({ p_content: content, p_consents: consents }) }, ownerToken)) as string;
  const now = new Date();
  const joyId = randomUUID();
  await rest("/rest/v1/members", {
    method: "POST",
    body: JSON.stringify([
      {
        id: joyId,
        circle_id: circleId,
        name: "Joy Banda",
        role: "home_aide",
        phone: "555-010-0188",
        visibility: {},
        token_hash: hashOf(tokenFor(joyId)),
        link_version: 1,
        link_issued_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      },
    ]),
  });
  return { circleId, ownerToken, ownerSession, joyId };
}

async function signInAsCaregiver(page: Page, session: Record<string, unknown>) {
  const name = `sb-${new URL(URL_).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await page.context().addCookies([{ name, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

/** A reviewed visit for this circle, as Review leaves it in the tab's storage: one appointment with a day and time, two reminders. */
function reviewedFlow(circleId: string) {
  const draft = sampleDraft(false);
  draft.tasks = [
    { id: "t-appt", title: "Cardiology follow-up", category: "appointment", dueDate: "2026-12-08", dueTime: "10:30", confidence: "high" },
    { id: "t-lab", title: "Blood test at the lab", category: "lab", dueText: "within 1 week", confidence: "high" },
    { id: "t-pickup", title: "Pick up the new prescription", category: "home", confidence: "high" },
  ];
  const reviewed = { medications: true, visit: true, tasks: true, watchFor: true, otherNotes: true, questions: true };
  return JSON.stringify({ state: { draft, isSample: false, unsorted: false, reviewed, caregiverFirstName: "", recipients: [], created: null, originalName: null, circleId, reader: "builtin" }, version: 4 });
}

test.describe("Update the circle: who helps, and texting them", () => {
  test.skip(!ready, "needs the test database from .env.local");
  let seeded: Seeded;
  let skip = "";

  test.beforeAll(async () => {
    const made = await seed();
    if (made) seeded = made;
    else skip = "password sign-in is off on this test database";
  });

  test.beforeEach(() => {
    test.skip(Boolean(skip), skip);
  });

  test.afterAll(async () => {
    if (seeded) await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.circleId }) }, seeded.ownerToken);
  });

  test("pick Me, someone in the circle, or add someone; they join on Update and get a text with their link", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "saves to the circle; run once");
    await signInAsCaregiver(page, seeded.ownerSession);
    await page.addInitScript((flow) => {
      if (!sessionStorage.getItem("aftervisit-flow")) sessionStorage.setItem("aftervisit-flow", flow);
    }, reviewedFlow(seeded.circleId));
    await page.goto("/new/apply");
    await expect(page.getByRole("heading", { name: "Update Teodora's circle" })).toBeVisible();

    // Me, the people in the circle, and Add someone. The old "decide later" choices are gone; nobody is picked to start with.
    const appt = page.getByRole("list", { name: "Who's going to Cardiology follow-up" });
    await expect(appt.getByRole("button")).toHaveText(["Me", "Joy Banda (Home aide)", "Add someone"]);
    await expect(page.getByRole("button", { name: /Decide later|Needs someone|Anyone can offer/ })).toHaveCount(0);
    await expect(appt.getByRole("button", { pressed: true })).toHaveCount(0);

    // Tapping a picked name again clears it.
    await appt.getByRole("button", { name: "Me", exact: true }).click();
    await expect(appt.getByRole("button", { name: "Me", exact: true })).toHaveAttribute("aria-pressed", "true");
    await appt.getByRole("button", { name: "Me", exact: true }).click();
    await expect(appt.getByRole("button", { name: "Me", exact: true })).toHaveAttribute("aria-pressed", "false");

    // Someone new, right here.
    await appt.getByRole("button", { name: "Add someone" }).click();
    const form = page.getByRole("form", { name: "Add someone" });
    await form.getByRole("button", { name: "Add them" }).click();
    await expect(form.getByRole("alert")).toHaveText("Type their name.");
    await form.getByLabel("Name").fill("Anna Lee");
    await form.getByLabel(/Phone/).fill("12");
    await form.getByRole("button", { name: "Add Anna" }).click();
    await expect(form.getByRole("alert")).toContainText("Enter a phone number");
    await form.getByLabel(/Phone/).fill("555-010-0142");
    await form.getByRole("button", { name: "Add Anna" }).click();
    await expect(form).toHaveCount(0);
    await expect(appt.getByRole("button", { name: "Anna Lee (Family)" })).toHaveAttribute("aria-pressed", "true");

    // Nothing is saved yet.
    expect(await rest(`/rest/v1/members?select=id&circle_id=eq.${seeded.circleId}&name=eq.Anna%20Lee`)).toHaveLength(0);

    // Someone added by mistake and then unpicked is never saved.
    const lab = page.getByRole("list", { name: "Who does Blood test at the lab" });
    await lab.getByRole("button", { name: "Add someone" }).click();
    await page.getByRole("form", { name: "Add someone" }).getByLabel("Name").fill("Ben Typo");
    await page.getByRole("form", { name: "Add someone" }).getByRole("button", { name: "Add Ben" }).click();
    await expect(lab.getByRole("button", { name: "Ben Typo (Family)" })).toHaveAttribute("aria-pressed", "true");
    await lab.getByRole("button", { name: "Ben Typo (Family)" }).click();

    // The new person can be picked for the reminders too.
    await page.getByRole("list", { name: "Who does Blood test at the lab" }).getByRole("button", { name: "Joy Banda (Home aide)" }).click();
    await page.getByRole("list", { name: "Who does Pick up the new prescription" }).getByRole("button", { name: "Anna Lee (Family)" }).click();

    await page.getByRole("button", { name: "Update the circle" }).click();
    await expect(page.getByRole("heading", { name: "Teodora's circle is up to date" })).toBeVisible();

    // Anna joined the circle, and the appointment and reminders are theirs.
    const [anna] = await rest(`/rest/v1/members?select=id,role,phone,visibility&circle_id=eq.${seeded.circleId}&name=eq.Anna%20Lee`);
    expect(anna).toMatchObject({ role: "family", phone: "555-010-0142" });
    // Added for the calendar and reminders, so that is what they see.
    expect([...anna.visibility.hidden].sort()).toEqual(["handoff", "medications", "summary"]);
    expect(await rest(`/rest/v1/members?select=id&circle_id=eq.${seeded.circleId}&name=eq.Ben%20Typo`)).toHaveLength(0);
    const [event] = await rest(`/rest/v1/events?select=going_member_id,going_caregiver,needs_volunteer&circle_id=eq.${seeded.circleId}&title=eq.Cardiology%20follow-up`);
    expect(event).toMatchObject({ going_member_id: anna.id, going_caregiver: false, needs_volunteer: false });
    const todos = (await rest(`/rest/v1/todos?select=title,assignee_member_id&circle_id=eq.${seeded.circleId}`)) as { title: string; assignee_member_id: string | null }[];
    expect(todos.find((todo) => todo.title === "Blood test at the lab")?.assignee_member_id).toBe(seeded.joyId);
    expect(todos.find((todo) => todo.title === "Pick up the new prescription")?.assignee_member_id).toBe(anna.id);

    // A text for each, to their number, with their link. It says when, not what the appointment is for.
    const tell = page.getByRole("region", { name: "Text each person what they are down for" });
    const textAnna = tell.getByRole("link", { name: "Text Anna" });
    const annaHref = (await textAnna.getAttribute("href"))!;
    expect(annaHref.startsWith("sms:5550100142?&body=")).toBe(true);
    const annaBody = decodeURIComponent(annaHref.split("&body=")[1]);
    expect(annaBody).toContain("I added you to Teodora's care circle");
    expect(annaBody).toContain("Going with Teodora to an appointment on Tuesday, December 8 at 10:30 AM");
    expect(annaBody).toContain("1 reminder to take care of");
    expect(annaBody).not.toMatch(/Cardiology|prescription/i);
    const annaUrl = annaBody.match(/http\S+\/i\/\S+/)![0];

    const textJoy = tell.getByRole("link", { name: "Text Joy" });
    await expect(textJoy).toHaveAttribute("href", /^sms:5550100188\?&body=/);
    const joyBody = decodeURIComponent((await textJoy.getAttribute("href"))!.split("&body=")[1]);
    expect(joyBody).toContain("same link as before");
    expect(joyBody).toContain(`/i/${tokenFor(seeded.joyId)}`);
    // Joy is not offered twice in "Let people know what changed".
    await expect(page.getByRole("button", { name: "Tell Joy" })).toHaveCount(0);
    await expect(tell.getByText("Ben Typo")).toHaveCount(0);

    // Anna's link opens the circle on a phone that has never seen it.
    const phone = await browser.newContext();
    const annaPage = await phone.newPage();
    await annaPage.goto(annaUrl);
    await annaPage.waitForURL(`**/circles/${seeded.circleId}`);
    await phone.close();
  });
});
