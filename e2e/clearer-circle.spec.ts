import AxeBuilder from "@axe-core/playwright";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

/**
 * A circle that is easy to understand for the people in it. Lena, a fictional caregiver with a phone
 * number saved, runs Teodora's circle. The first time each person opens it, they are told who added
 * them, what they can see and who to ask, until they tap Got it; then Today keeps a short "What you
 * can see" line. Joy (family, Everything), Sam (family, "Calendar and reminders only") and Ana (home
 * aide, Everything: her own reminders only) open their links; Pat, whom Lena hid people from, is not
 * told who runs it; Ivy is signed in with the account her link is saved to. Lena's People page says
 * what each choice includes for the role, and a change reaches Sam's same link at once.
 *
 * Skipped when the test database is not set up here or has password sign-in off. The circle is
 * deleted afterwards.
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

type Session = Record<string, unknown> & { access_token: string; user: { id: string } };
type Person = { session: Session };

/** A fictional user with a password, signed in. Null when password sign-in is off here. */
async function user(name: string): Promise<Person | null> {
  const email = `${name.toLowerCase().replace(/\W+/g, ".")}.${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  await rest("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } }) });
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  return { session: (await res.json()) as Session };
}

async function circle(owner: Person, personName: string): Promise<string> {
  const consents = ["authorized_to_share", "terms", "privacy"].map((type) => ({ type, version: "2026-11-20", text_hash: createHash("sha256").update(type).digest("hex") }));
  return (await rest(
    "/rest/v1/rpc/create_circle",
    { method: "POST", body: JSON.stringify({ p_content: { person_name: personName, allergies: [], doctors: [], emergency_contacts: [] }, p_consents: consents }) },
    owner.session.access_token,
  )) as string;
}

/** A person with their own link, written the way the app writes them, optionally saved to an account. */
async function member(circleId: string, name: string, role: string, extra: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await rest("/rest/v1/members", {
    method: "POST",
    body: JSON.stringify({
      id,
      circle_id: circleId,
      name,
      role,
      token_hash: hashOf(tokenFor(id)),
      link_version: 1,
      link_issued_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      visibility: {},
      ...extra,
    }),
  });
  return tokenFor(id);
}

async function signIn(context: BrowserContext, who: Person) {
  const name = `sb-${new URL(URL_).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(who.session)).toString("base64url")}`;
  await context.addCookies([{ name, value, url: test.info().project.use.baseURL, httpOnly: true, sameSite: "Lax" }]);
}

async function fresh(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  return { context, page: await context.newPage() };
}

const top = (page: Page): Locator => page.locator("[data-circle-top]");
const welcome = (page: Page): Locator => top(page).locator("[data-welcome]");
const seeLine = (page: Page): Locator => page.locator("[data-what-you-see]");

async function audit(page: Page, label: string) {
  if (test.info().project.name === "iphone-safari") return;
  const results = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), label).toEqual([]);
}

const EVERYTHING = "the calendar, reminders, medications, the care summary and visit notes";
const CALENDAR_ONLY = "the calendar and reminders";

type Seeded = { lena: Person; ivy: Person; teodora: string; joy: string; sam: string; ana: string; pat: string };

test.describe("a circle that is easy to understand", () => {
  test.skip(!ready, "needs the test database from .env.local");
  test.describe.configure({ mode: "serial" });
  let seeded: Seeded;
  let skip = "";

  test.beforeAll(async () => {
    const [lena, ivy] = await Promise.all([user("Lena Ortiz"), user("Ivy Chen")]);
    if (!lena || !ivy) {
      skip = "password sign-in is off on this test database";
      return;
    }
    const teodora = await circle(lena, "Teodora Ruiz");
    await rest(`/rest/v1/circle_caregivers?circle_id=eq.${teodora}`, { method: "PATCH", body: JSON.stringify({ phone: "555-010-0100" }) }, lena.session.access_token);
    const calendarOnly = { visibility: { hidden: ["medications", "summary", "handoff"] } };
    const [joy, sam, ana, pat] = await Promise.all([
      member(teodora, "Joy Banda", "family"),
      member(teodora, "Sam Ortiz", "family", calendarOnly),
      member(teodora, "Ana Silva", "home_aide"),
      member(teodora, "Pat Lee", "day_program", { visibility: { members: "off" } }),
      member(teodora, "Ivy Chen", "care_manager", { ...calendarOnly, user_id: ivy.session.user.id }),
    ]);
    seeded = { lena, ivy, teodora, joy, sam, ana, pat };
  });

  test.beforeEach(() => {
    test.skip(Boolean(skip), skip);
  });

  test.afterAll(async () => {
    if (!seeded) return;
    await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.teodora }) }, seeded.lena.session.access_token);
  });

  test("the first open says who added you, what you can see and who to ask; Got it leaves a short line on Today", async ({ browser }) => {
    const { teodora, joy } = seeded;
    const { context, page } = await fresh(browser);
    await page.goto(`/i/${joy}`);
    await page.waitForURL(`**/circles/${teodora}`);
    await expect(welcome(page)).toContainText("Lena Ortiz added you to Teodora Ruiz's circle.");
    await expect(welcome(page)).toContainText(`You can see: ${EVERYTHING}.`);
    await expect(welcome(page)).toContainText("Ask Lena if you need more.");
    await expect(welcome(page).getByRole("link", { name: "Call Lena Ortiz, 555-010-0100" })).toHaveAttribute("href", "tel:5550100100");
    await expect(welcome(page).getByRole("link", { name: "Text Lena Ortiz, 555-010-0100" })).toHaveAttribute("href", /^sms:5550100100\?/);
    // The welcome says who runs it in full, so the short line, and its Call button, are not there twice.
    await expect(top(page)).not.toContainText("runs this circle");
    await expect(top(page).getByRole("link", { name: /^Call / })).toHaveCount(1);
    await expect(seeLine(page)).toHaveCount(0);
    await audit(page, "welcome");

    // It stays until Got it, on any page and after a reload.
    await page.goto(`/circles/${teodora}/calendar`);
    await expect(welcome(page)).toBeVisible();
    await page.goto(`/circles/${teodora}`);
    await welcome(page).getByRole("button", { name: "Got it" }).click();
    await expect(welcome(page)).toHaveCount(0);
    await expect(top(page)).toContainText("Lena Ortiz runs this circle");
    await expect(seeLine(page)).toHaveText(`What you can see: ${EVERYTHING}. Ask Lena if you need more.`);
    await audit(page, "what you can see");
    await page.reload();
    await expect(seeLine(page)).toBeVisible();
    await expect(welcome(page)).toHaveCount(0);
    await context.close();
  });

  test("Calendar and reminders only, and a home aide, are told just what they get", async ({ browser }) => {
    const { teodora, sam, ana } = seeded;
    const one = await fresh(browser);
    await one.page.goto(`/i/${sam}`);
    await one.page.waitForURL(`**/circles/${teodora}`);
    await expect(welcome(one.page)).toContainText(`You can see: ${CALENDAR_ONLY}.`);
    await welcome(one.page).getByRole("button", { name: "Got it" }).click();
    await expect(seeLine(one.page)).toContainText(`What you can see: ${CALENDAR_ONLY}.`);

    const two = await fresh(browser);
    await two.page.goto(`/i/${ana}`);
    await two.page.waitForURL(`**/circles/${teodora}`);
    await expect(welcome(two.page)).toContainText("You can see: the calendar, your own reminders, medications, the care summary and visit notes.");
    await welcome(two.page).getByRole("button", { name: "Got it" }).click();
    await expect(seeLine(two.page)).toContainText("What you can see: the calendar, your own reminders,");
    await Promise.all([one.context.close(), two.context.close()]);
  });

  test("someone hidden from people is welcomed without a name; someone signed in is welcomed too", async ({ browser }) => {
    const { teodora, pat, ivy } = seeded;
    const one = await fresh(browser);
    await one.page.goto(`/i/${pat}`);
    await one.page.waitForURL(`**/circles/${teodora}`);
    await expect(welcome(one.page)).toContainText("You were added to Teodora Ruiz's circle.");
    await expect(welcome(one.page)).toContainText("Ask the person who runs the circle if you need more.");
    await expect(welcome(one.page).getByRole("link")).toHaveCount(0);
    await expect(welcome(one.page)).not.toContainText("Lena");

    const two = await fresh(browser);
    await signIn(two.context, ivy);
    await two.page.goto(`/circles/${teodora}`);
    await expect(welcome(two.page)).toContainText("Lena Ortiz added you to Teodora Ruiz's circle.");
    await expect(welcome(two.page)).toContainText(`You can see: ${CALENDAR_ONLY}.`);
    await welcome(two.page).getByRole("button", { name: "Got it" }).click();
    await expect(seeLine(two.page)).toContainText(`What you can see: ${CALENDAR_ONLY}.`);
    await Promise.all([one.context.close(), two.context.close()]);
  });

  test("People says what each choice includes for the role, and a change works on the same link at once", async ({ browser }) => {
    const { lena, teodora, sam } = seeded;
    const caregiver = await fresh(browser);
    await signIn(caregiver.context, lena);
    await caregiver.page.goto(`/circles/${teodora}/members`);

    // A home aide on "Everything" still sees only their own reminders, and the picker says so.
    await caregiver.page.getByRole("button", { name: /Ana Silva/ }).click();
    await caregiver.page.getByText("More: what Ana sees, role, when the link ends").click();
    const ana = caregiver.page.getByRole("group", { name: "What can Ana see?" });
    await expect(ana.getByText("The calendar, their own reminders, medications, the care summary and visit notes.")).toBeVisible();
    await expect(ana.getByText("The calendar and their own reminders. Good for neighbors, friends and aides.")).toBeVisible();
    await expect(caregiver.page.getByText("A change works on Ana's same link right away. No new link needed.")).toBeVisible();
    await caregiver.page.getByRole("button", { name: /Ana Silva/ }).click();

    // Sam already has his link open on his phone.
    const phone = await fresh(browser);
    await phone.page.goto(`/i/${sam}`);
    await phone.page.waitForURL(`**/circles/${teodora}`);
    await welcome(phone.page).getByRole("button", { name: "Got it" }).click();
    await expect(seeLine(phone.page)).toContainText(`What you can see: ${CALENDAR_ONLY}.`);

    await caregiver.page.getByRole("button", { name: /Sam Ortiz/ }).click();
    await caregiver.page.getByText("More: what Sam sees, role, when the link ends").click();
    const samSees = caregiver.page.getByRole("group", { name: "What can Sam see?" });
    await expect(samSees.getByText("The calendar and reminders. Good for neighbors, friends and aides.")).toBeVisible();
    await samSees.getByText("Everything", { exact: true }).click();
    await caregiver.page.getByRole("button", { name: "Save what Sam sees" }).click();
    await expect(caregiver.page.getByRole("button", { name: "Save what Sam sees" })).toBeEnabled();

    // Same link, no new one: a reload shows more.
    await expect(async () => {
      await phone.page.reload();
      await expect(seeLine(phone.page)).toContainText(`What you can see: ${EVERYTHING}.`, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await Promise.all([caregiver.context.close(), phone.context.close()]);
  });
});

// Needs no database.
test("the home page and the guide show how a circle works", async ({ page }) => {
  for (const path of ["/", "/guides/share-the-care"]) {
    await page.goto(path);
    const model = page.locator("[data-circle-model]");
    await expect(model.getByText("How a circle works")).toBeVisible();
    await expect(model).toContainText("You, the caregiver");
    await expect(model).toContainText("Runs the circle");
    await expect(model.getByText("Own link", { exact: true })).toHaveCount(3);
  }
});
