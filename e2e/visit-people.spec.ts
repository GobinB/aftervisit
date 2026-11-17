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

type Seeded = { circleId: string; ownerToken: string; ownerSession: Record<string, unknown>; joyId: string; oldJoyToken: string; samId: string; rosaId: string; oldRosaToken: string };

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
  // Sam is in the circle with a current link and is not picked for anything on this visit.
  const samId = randomUUID();
  // Rosa has an older link too and is not picked: "Tell Rosa" must not replace it without a tap.
  const rosaId = randomUUID();
  const oldRosaToken = randomUUID().replace(/-/g, "").slice(0, 24);
  // Joy has an older, random link, from before links could be shared again.
  const oldJoyToken = randomUUID().replace(/-/g, "").slice(0, 24);
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
        token_hash: hashOf(oldJoyToken),
        link_version: 1,
        link_issued_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      },
      {
        id: rosaId,
        circle_id: circleId,
        name: "Rosa Diaz",
        role: "family",
        phone: null,
        visibility: {},
        token_hash: hashOf(oldRosaToken),
        link_version: 1,
        link_issued_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      },
      {
        id: samId,
        circle_id: circleId,
        name: "Sam Ortiz",
        role: "family",
        phone: null,
        visibility: {},
        token_hash: hashOf(tokenFor(samId)),
        link_version: 1,
        link_issued_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      },
    ]),
  });
  return { circleId, ownerToken, ownerSession, joyId, oldJoyToken, samId, rosaId, oldRosaToken };
}

async function signInAsCaregiver(page: Page, session: Record<string, unknown>) {
  const name = `sb-${new URL(URL_).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await page.context().addCookies([{ name, value, url: test.info().project.use.baseURL, httpOnly: true, sameSite: "Lax" }]);
}

/** A reviewed visit for this circle, as Review leaves it in the tab's storage: one appointment with a day and time, one with none, two reminders. */
function reviewedFlow(circleId: string) {
  const draft = sampleDraft(false);
  draft.tasks = [
    { id: "t-appt", title: "Cardiology follow-up", category: "appointment", dueDate: "2026-12-08", dueTime: "10:30", confidence: "high" },
    { id: "t-lab", title: "Blood test at the lab", category: "lab", dueText: "within 1 week", confidence: "high" },
    { id: "t-pickup", title: "Pick up the new prescription", category: "home", confidence: "high" },
    { id: "t-eye", title: "Eye doctor visit", category: "appointment", confidence: "high" },
  ];
  const reviewed = { medications: true, visit: true, tasks: true, watchFor: true, otherNotes: true, questions: true };
  return JSON.stringify({ state: { draft, isSample: false, unsorted: false, reviewed, caregiverFirstName: "", recipients: [], created: null, originalName: null, circleId, reader: "builtin" }, version: 5 });
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
    await expect(appt.getByRole("button")).toHaveCount(5);
    await expect(appt.getByRole("button").first()).toHaveText("Me");
    await expect(appt.getByRole("button").last()).toHaveText("Add someone");
    await expect(appt.getByRole("button", { name: "Joy Banda (Home aide)" })).toBeVisible();
    await expect(appt.getByRole("button", { name: "Sam Ortiz (Family)" })).toBeVisible();
    await expect(appt.getByRole("button", { name: "Rosa Diaz (Family)" })).toBeVisible();
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

    // An appointment with no day stays an appointment here; left without one, it goes in as a reminder.
    await expect(page.getByText("Pick the day to put it on the calendar, or it goes in as a reminder.")).toBeVisible();

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
    // By when is picked here, beside who does it (Review no longer asks).
    await page.getByLabel("By when: Pick up the new prescription").fill("2026-12-01");

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
    const todos = (await rest(`/rest/v1/todos?select=title,assignee_member_id,due_date&circle_id=eq.${seeded.circleId}`)) as { title: string; assignee_member_id: string | null; due_date: string | null }[];
    expect(todos.find((todo) => todo.title === "Pick up the new prescription")?.due_date).toBe("2026-12-01");
    expect(todos.find((todo) => todo.title === "Eye doctor visit")).toBeTruthy();
    expect(todos.find((todo) => todo.title === "Blood test at the lab")?.assignee_member_id).toBe(seeded.joyId);
    expect(todos.find((todo) => todo.title === "Pick up the new prescription")?.assignee_member_id).toBe(anna.id);

    // Each person's link on screen, with Text, Email and Copy. The text says when, not what the appointment is for.
    const tell = page.getByRole("region", { name: "Send each person their link" });
    const textAnna = tell.getByRole("link", { name: "Text Anna" });
    const annaHref = (await textAnna.getAttribute("href"))!;
    expect(annaHref.startsWith("sms:5550100142?&body=")).toBe(true);
    const annaBody = decodeURIComponent(annaHref.split("&body=")[1]);
    expect(annaBody).toContain("I added you to Teodora's care circle");
    expect(annaBody).toContain("Going with Teodora to an appointment on Tuesday, December 8 at 10:30 AM");
    expect(annaBody).toContain("1 reminder to take care of");
    expect(annaBody).not.toMatch(/Cardiology|prescription/i);
    const annaUrl = annaBody.match(/http\S+\/i\/\S+/)![0];
    await expect(tell.getByRole("textbox", { name: "Anna's link" })).toHaveValue(annaUrl);
    const emailAnna = (await tell.getByRole("link", { name: "Email Anna" }).getAttribute("href"))!;
    expect(emailAnna.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(emailAnna.split("&body=")[1])).toBe(annaBody);

    // Joy's older link is left alone when this screen opens: it still works, until "Make a new link".
    const joyRow = tell.getByRole("listitem").filter({ hasText: "Joy Banda" });
    const makeLink = joyRow.getByRole("button", { name: "Make a new link" });
    await expect(makeLink).toBeVisible();
    await expect(joyRow).toContainText("Making a new one to text them stops the old one working.");
    await expect(tell.getByRole("link", { name: "Text Joy" })).toHaveCount(0);
    const joyHash = async () => ((await rest(`/rest/v1/members?select=token_hash&id=eq.${seeded.joyId}`)) as { token_hash: string }[])[0].token_hash;
    expect(await joyHash()).toBe(hashOf(seeded.oldJoyToken));
    const joyPhone = await browser.newContext();
    const oldPage = await joyPhone.newPage();
    await oldPage.goto(`/i/${seeded.oldJoyToken}`);
    await oldPage.waitForURL(`**/circles/${seeded.circleId}`);
    await joyPhone.close();

    await makeLink.click();
    const textJoy = tell.getByRole("link", { name: "Text Joy" });
    await expect(textJoy).toHaveAttribute("href", /^sms:5550100188\?&body=/);
    const joyBody = decodeURIComponent((await textJoy.getAttribute("href"))!.split("&body=")[1]);
    expect(joyBody).toContain("The details are on your new link. The one you had before no longer works:");
    expect(joyBody).toContain(`/i/${tokenFor(seeded.joyId)}`);
    expect(await joyHash()).toBe(hashOf(tokenFor(seeded.joyId)));

    // When copying fails, the link on screen is there to copy by hand.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("blocked")) } });
    });
    await tell.getByRole("button", { name: "Copy Joy's link" }).click();
    await expect(tell.getByRole("alert")).toContainText("Copying did not work");
    await expect(tell.getByRole("textbox", { name: "Joy's link" })).toHaveValue(new RegExp(`/i/${tokenFor(seeded.joyId)}$`));
    // Joy is listed once, not again as someone who has not seen the changes.
    await expect(tell.getByText("Joy Banda", { exact: true })).toHaveCount(1);
    // Sam was not picked for anything but can see what changed: listed too, link on screen, the message says what changed.
    const samRow = tell.getByRole("listitem").filter({ hasText: "Sam Ortiz" });
    await expect(samRow).toContainText("Has not seen the changes yet");
    await expect(samRow.getByRole("textbox", { name: "Sam's link" })).toHaveValue(new RegExp(`/i/${tokenFor(seeded.samId)}$`));
    const samBody = decodeURIComponent((await samRow.getByRole("link", { name: "Text Sam" }).getAttribute("href"))!.split("&body=")[1]);
    expect(samBody).toMatch(/I updated Teodora's care circle on All Hands Care: .+ changed/);
    expect(samBody).toContain(`/i/${tokenFor(seeded.samId)}`);

    // Opening Messages is not sending: a tap asks "Sent it?", and only a yes marks them as told.
    await page.evaluate(() =>
      document.addEventListener("click", (event) => {
        if ((event.target as Element).closest('a[href^="sms:"], a[href^="mailto:"]')) event.preventDefault();
      }, true),
    );
    const toldAt = async (id: string) => ((await rest(`/rest/v1/members?select=last_told_at&id=eq.${id}`)) as { last_told_at: string | null }[])[0].last_told_at;
    const annaRow = tell.getByRole("listitem").filter({ hasText: "Anna Lee" });
    await annaRow.getByRole("link", { name: "Text Anna" }).click();
    await annaRow.getByRole("group", { name: "Sent it to Anna?" }).getByRole("button", { name: "Not yet" }).click();
    await expect(annaRow.getByRole("group", { name: "Sent it to Anna?" })).toHaveCount(0);
    await expect(annaRow.getByRole("status")).toHaveCount(0);
    expect(await toldAt(anna.id)).toBeNull();
    await samRow.getByRole("link", { name: "Email Sam" }).click();
    expect(await toldAt(seeded.samId)).toBeNull();
    await samRow.getByRole("group", { name: "Sent it to Sam?" }).getByRole("button", { name: "Yes, sent" }).click();
    await expect(samRow.getByRole("status")).toHaveText("Sent");
    await expect.poll(() => toldAt(seeded.samId)).not.toBeNull();

    // On Today, "Let people know what changed" works the same: Done without "Yes, sent" keeps Anna on the list.
    await page.goto(`/circles/${seeded.circleId}`);
    await page.evaluate(() =>
      document.addEventListener("click", (event) => {
        if ((event.target as Element).closest('a[href^="sms:"], a[href^="mailto:"]')) event.preventDefault();
      }, true),
    );
    const updates = page.getByRole("region", { name: "Let people know what changed" });
    await updates.getByRole("button", { name: "Tell Anna" }).click();
    const panel = page.getByRole("region", { name: "Tell Anna what changed" });
    // Text goes to Anna's number.
    await expect(panel.getByRole("link", { name: /Text message/ })).toHaveAttribute("href", /^sms:5550100142\?&body=/);
    await panel.getByRole("link", { name: /Text message/ }).click();
    await expect(panel.getByRole("group", { name: "Sent it to Anna?" })).toBeVisible();
    await panel.getByRole("button", { name: "Done" }).click();
    await expect(updates.getByRole("button", { name: "Tell Anna" })).toBeVisible();
    expect(await toldAt(anna.id)).toBeNull();
    await updates.getByRole("button", { name: "Tell Anna" }).click();
    await panel.getByRole("link", { name: /Email/ }).click();
    await panel.getByRole("group", { name: "Sent it to Anna?" }).getByRole("button", { name: "Yes, sent" }).click();
    await expect(panel.getByRole("status")).toHaveText("Sent");
    await expect.poll(() => toldAt(anna.id)).not.toBeNull();
    await panel.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Tell Anna" })).toHaveCount(0);

    // "Tell Rosa": her older link is left alone until "Make a new link".
    const rosaHash = async () => ((await rest(`/rest/v1/members?select=token_hash&id=eq.${seeded.rosaId}`)) as { token_hash: string }[])[0].token_hash;
    await updates.getByRole("button", { name: "Tell Rosa" }).click();
    await expect(updates).toContainText("Making a new one to text them stops the old one working.");
    expect(await rosaHash()).toBe(hashOf(seeded.oldRosaToken));
    await updates.getByRole("button", { name: "Make a new link" }).click();
    const rosaPanel = page.getByRole("region", { name: "Tell Rosa what changed" });
    await expect(rosaPanel).toContainText("with their new link");
    expect(await rosaHash()).toBe(hashOf(tokenFor(seeded.rosaId)));
    const rosaBody = decodeURIComponent((await rosaPanel.getByRole("link", { name: /Text message/ }).getAttribute("href"))!.split("&body=")[1]);
    expect(rosaBody).toContain("Here is your new link (the one you had before no longer works)");
    await rosaPanel.getByRole("button", { name: "Done" }).click();

    // Reminders: Mark done keeps the row, crossed out; undoing asks first; "Give to…" hands one over.
    await page.goto(`/circles/${seeded.circleId}/todos`);
    const todoStatus = async (title: string) =>
      ((await rest(`/rest/v1/todos?select=status,assignee_member_id&circle_id=eq.${seeded.circleId}&title=eq.${encodeURIComponent(title)}`)) as { status: string; assignee_member_id: string | null }[])[0];
    await page.getByRole("button", { name: "Mark done: Pick up the new prescription" }).click();
    await expect.poll(async () => (await todoStatus("Pick up the new prescription")).status).toBe("done");
    // Still on the Open list after the save comes back.
    await page.waitForTimeout(800);
    const doneButton = page.getByRole("button", { name: "Done: Pick up the new prescription" });
    await expect(doneButton).toBeVisible();
    await expect(page.getByText("Pick up the new prescription", { exact: true })).toHaveClass(/line-through/);
    await doneButton.click();
    const undo = page.getByRole("group", { name: "Not done yet: Pick up the new prescription?" });
    await undo.getByRole("button", { name: "Keep done" }).click();
    expect((await todoStatus("Pick up the new prescription")).status).toBe("done");
    await doneButton.click();
    await undo.getByRole("button", { name: "Yes, open it again" }).click();
    await expect.poll(async () => (await todoStatus("Pick up the new prescription")).status).toBe("open");
    // Eye doctor visit needs a volunteer: give it to Sam.
    await page.getByRole("button", { name: "Give to…" }).first().click();
    await page.getByRole("list", { name: 'Give "Eye doctor visit" to' }).getByRole("button", { name: /Sam Ortiz/ }).click();
    await expect.poll(async () => (await todoStatus("Eye doctor visit")).assignee_member_id).toBe(seeded.samId);
    await expect(tell.getByText("Ben Typo")).toHaveCount(0);

    // Anna's link opens the circle on a phone that has never seen it.
    const phone = await browser.newContext();
    const annaPage = await phone.newPage();
    await annaPage.goto(annaUrl);
    await annaPage.waitForURL(`**/circles/${seeded.circleId}`);
    await phone.close();
  });
});
