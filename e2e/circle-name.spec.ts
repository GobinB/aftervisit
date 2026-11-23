import { createHash, createHmac, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

/**
 * The person's name, large, at the top of every circle screen, and who runs the circle under it.
 * Lena, a fictional caregiver with a phone number saved, runs Teodora's circle; Marco runs Walter's
 * and has none. Joy opens Teodora's circle with her link and can call or text Lena; Pat, whom Lena
 * hid people from, sees the name only. Ivy helps in both circles through her account and switches
 * between them by tapping the name.
 *
 * Skipped when the test database is not set up here or has password sign-in off. The circles are
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

/** The name and who runs the circle, at the top of the page. */
const top = (page: Page): Locator => page.locator("[data-circle-top]");

type Seeded = { lena: Person; marco: Person; ivy: Person; teodora: string; walter: string; joy: string; pat: string };

test.describe("the person's name and who runs the circle", () => {
  test.skip(!ready, "needs the test database from .env.local");
  test.describe.configure({ mode: "serial" });
  let seeded: Seeded;
  let skip = "";

  test.beforeAll(async () => {
    const [lena, marco, ivy] = await Promise.all([user("Lena Ortiz"), user("Marco Kim"), user("Ivy Chen")]);
    if (!lena || !marco || !ivy) {
      skip = "password sign-in is off on this test database";
      return;
    }
    const [teodora, walter] = await Promise.all([circle(lena, "Teodora Ruiz"), circle(marco, "Walter Kim")]);
    // Lena saves her number as she would on her own row; Marco has none.
    await rest(`/rest/v1/circle_caregivers?circle_id=eq.${teodora}`, { method: "PATCH", body: JSON.stringify({ phone: "555-010-0100" }) }, lena.session.access_token);
    const [joy, pat] = await Promise.all([
      member(teodora, "Joy Banda", "home_aide"),
      member(teodora, "Pat Lee", "day_program", { visibility: { members: "off" } }),
      member(teodora, "Ivy Chen", "care_manager", { user_id: ivy.session.user.id }),
      member(walter, "Ivy Chen", "family", { user_id: ivy.session.user.id }),
    ]);
    seeded = { lena, marco, ivy, teodora, walter, joy, pat };
  });

  test.beforeEach(() => {
    test.skip(Boolean(skip), skip);
  });

  test.afterAll(async () => {
    if (!seeded) return;
    await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.teodora }) }, seeded.lena.session.access_token);
    await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.walter }) }, seeded.marco.session.access_token);
  });

  test("the caregiver sees the name and that she runs it on every screen", async ({ browser }) => {
    const { lena, teodora } = seeded;
    const { context, page } = await fresh(browser);
    await signIn(context, lena);
    for (const path of ["", "/medications", "/medications/new", "/calendar", "/members", "/settings"]) {
      await page.goto(`/circles/${teodora}${path}`);
      await expect(top(page).getByText("Teodora Ruiz", { exact: true })).toBeVisible();
      await expect(top(page)).toContainText("You run this circle");
      // No calling herself, and with one circle the name is not a switch.
      await expect(top(page).getByRole("link")).toHaveCount(0);
      await expect(top(page).locator("summary")).toHaveCount(0);
    }
    await context.close();
  });

  test("a person with a link sees who runs it and can call or text her; someone hidden from people sees the name only", async ({ browser }) => {
    const { teodora, joy, pat } = seeded;
    const one = await fresh(browser);
    await one.page.goto(`/i/${joy}`);
    await one.page.waitForURL(`**/circles/${teodora}`);
    for (const path of ["", "/calendar", "/emergency"]) {
      if (path) await one.page.goto(`/circles/${teodora}${path}`);
      await expect(top(one.page).getByText("Teodora Ruiz", { exact: true })).toBeVisible();
      await expect(top(one.page)).toContainText("Lena Ortiz runs this circle");
      await expect(top(one.page).getByRole("link", { name: "Call Lena Ortiz, 555-010-0100" })).toHaveAttribute("href", "tel:5550100100");
      await expect(top(one.page).getByRole("link", { name: "Text Lena Ortiz, 555-010-0100" })).toHaveAttribute("href", /^sms:5550100100\?/);
    }

    const two = await fresh(browser);
    await two.page.goto(`/i/${pat}`);
    await two.page.waitForURL(`**/circles/${teodora}`);
    await expect(top(two.page).getByText("Teodora Ruiz", { exact: true })).toBeVisible();
    await expect(top(two.page)).not.toContainText("runs this circle");
    await expect(top(two.page).getByRole("link")).toHaveCount(0);
    await Promise.all([one.context.close(), two.context.close()]);
  });

  test("someone in two circles switches between them by tapping the name", async ({ browser }) => {
    const { ivy, teodora, walter } = seeded;
    const { context, page } = await fresh(browser);
    await signIn(context, ivy);
    await page.goto(`/circles/${teodora}/calendar`);
    await expect(top(page)).toContainText("Lena Ortiz runs this circle");
    // One switcher on the page, at every width: the name.
    await expect(page.locator("summary[aria-label^='Switch circle']")).toHaveCount(1);
    await top(page).locator("summary").getByText("Teodora Ruiz", { exact: true }).click();
    await top(page).locator("details[open]").getByRole("link", { name: /Walter Kim.*You help · Family/ }).click();
    await page.waitForURL(`**/circles/${walter}`);
    await expect(top(page).locator("summary")).toHaveAccessibleName("Switch circle. Now: Walter Kim");
    await expect(top(page)).toContainText("Marco Kim runs this circle");
    // Marco saved no number, so there is nothing to call.
    await expect(top(page).getByRole("link", { name: /^(Call|Text) / })).toHaveCount(0);

    // And back, from the switch button beside the name.
    await top(page).locator("summary").getByText("Switch", { exact: true }).click();
    await top(page).locator("details[open]").getByRole("link", { name: /Teodora Ruiz/ }).click();
    await page.waitForURL(`**/circles/${teodora}`);
    await expect(top(page).locator("summary")).toHaveAccessibleName("Switch circle. Now: Teodora Ruiz");
    await context.close();
  });
});
