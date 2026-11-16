import { createHash, createHmac, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Emergency page and phone numbers, opened through people's own links. A fictional caregiver
 * signs in with a password on the test database (the one the app under test uses, from .env.local)
 * and makes a circle the way the app does; the people are written in with their links worked out
 * the way the app does it. Skipped when that database is not set up here, or has password sign-in
 * off. The circle is deleted afterwards.
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

/** The test database's REST, RPC and auth endpoints: as the service, or as the signed-in caregiver. */
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

type Seeded = { circleId: string; ownerToken: string; ownerSession: Record<string, unknown>; links: Record<"family" | "aide" | "hidden", string> };

async function seed(): Promise<Seeded | null> {
  const email = `emergency.${randomUUID()}@example.com`;
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
  const content = {
    person_name: "Teodora Ruiz",
    allergies: ["Penicillin", "Shellfish"],
    doctors: [],
    emergency_contacts: [
      { name: "Marco Ruiz", relationship: "Son", phone: "(555) 010-0177" },
      { name: "Sunny Hills Clinic", relationship: "After-hours line" },
    ],
  };
  const consents = ["authorized_to_share", "terms", "privacy"].map((type) => ({ type, version: "2026-11-03", text_hash: createHash("sha256").update(type).digest("hex") }));
  const circleId = (await rest("/rest/v1/rpc/create_circle", { method: "POST", body: JSON.stringify({ p_content: content, p_consents: consents }) }, ownerToken)) as string;
  // The caregiver's own number, set as they would set it.
  await rest(`/rest/v1/circle_caregivers?circle_id=eq.${circleId}`, { method: "PATCH", body: JSON.stringify({ phone: "555-010-0100" }) }, ownerToken);
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const ids = { family: randomUUID(), aide: randomUUID(), hidden: randomUUID(), noPhone: randomUUID() };
  const rows = [
    { id: ids.family, name: "Ana Ruiz", role: "family", phone: null, visibility: {} },
    { id: ids.aide, name: "Joy Banda", role: "home_aide", phone: "555-010-0188", visibility: {} },
    { id: ids.hidden, name: "Paul Ruiz", role: "family", phone: "555-010-0199", visibility: { hidden: ["summary"] } },
    { id: ids.noPhone, name: "Ivy Chen", role: "care_manager", phone: null, visibility: {} },
  ].map((row) => ({
    ...row,
    circle_id: circleId,
    token_hash: hashOf(tokenFor(row.id)),
    link_version: 1,
    link_issued_at: now.toISOString(),
    expires_at: later,
  }));
  await rest("/rest/v1/members", { method: "POST", body: JSON.stringify(rows) });
  return { circleId, ownerToken, ownerSession, links: { family: tokenFor(ids.family), aide: tokenFor(ids.aide), hidden: tokenFor(ids.hidden) } };
}

/** Signs the browser in as the caregiver, with the session cookie the app's Supabase client writes. */
async function signInAsCaregiver(page: Page, session: Record<string, unknown>) {
  const name = `sb-${new URL(URL_).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await page.context().addCookies([{ name, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

async function openLink(page: Page, token: string, circleId: string) {
  await page.goto(`/i/${token}`);
  await page.waitForURL(`**/circles/${circleId}`);
}

test.describe("Emergency page and phone numbers, through people's links", () => {
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
    // Deleted the way the caregiver deletes a circle; the daily cleanup erases it.
    if (seeded) await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.circleId }) }, seeded.ownerToken);
  });

  test("family: contacts first, then people with numbers, then allergies; big call buttons; their own number", async ({ page }, info) => {
    const phone = info.project.name !== "desktop-chrome";
    await openLink(page, seeded.links.family, seeded.circleId);
    // In the menu: on a phone it sits under More.
    if (phone) {
      await page.getByRole("navigation", { name: "Circle areas" }).getByText("More").click();
    }
    await page.getByRole("navigation", { name: "Circle areas" }).getByRole("link", { name: "Emergency" }).click();
    await expect(page.getByRole("heading", { name: "Emergency", level: 1 })).toBeVisible();

    const order = await page.locator("main h2").allInnerTexts();
    expect(order.slice(0, 3)).toEqual(["Emergency contacts", "People in the circle", "Allergies"]);

    const contacts = page.getByRole("region", { name: "Emergency contacts" });
    const marco = contacts.getByRole("link", { name: "Call Marco Ruiz, (555) 010-0177" });
    await expect(marco).toHaveAttribute("href", "tel:5550100177");
    const box = await marco.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await expect(contacts.getByText("No number written down")).toBeVisible();

    const people = page.getByRole("region", { name: "People in the circle" });
    // The caregiver first.
    await expect(people.getByRole("link").first()).toHaveAccessibleName("Call Lena Ortiz, 555-010-0100");
    await expect(people.getByRole("link", { name: "Call Joy Banda, 555-010-0188" })).toHaveAttribute("href", "tel:5550100188");
    // Nobody without a number, and nobody is offered a call to themselves.
    await expect(people.getByText("Ivy Chen")).toHaveCount(0);
    await expect(people.getByText("Ana Ruiz")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Allergies" }).getByText("Penicillin")).toBeVisible();

    // Their own number, from their link.
    const own = page.getByLabel(/Your number/);
    await own.fill("12");
    await page.getByRole("button", { name: "Save number" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a phone number" })).toBeVisible();
    await own.fill("555-010-0166");
    await page.getByRole("button", { name: "Save number" }).click();
    await expect(page.getByText("Number saved.")).toBeVisible();
    const saved = await rest(`/rest/v1/members?select=phone&circle_id=eq.${seeded.circleId}&name=eq.Ana%20Ruiz`);
    expect(saved[0].phone).toBe("555-010-0166");
    await own.fill("");
    await page.getByRole("button", { name: "Remove number" }).click();
    await expect(page.getByText("Number removed.")).toBeVisible();
    // Saving refreshes the page in the background; let it finish before moving on.
    await expect(page.getByRole("button", { name: "Save number" })).toBeDisabled();
    await page.waitForTimeout(500);

    // The People list calls too.
    await page.goto(`/circles/${seeded.circleId}/members`);
    await expect(page.getByRole("link", { name: "Call Joy Banda, 555-010-0188" })).toBeVisible();
    // Nothing on a phone scrolls sideways.
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(wide).toBe(false);
  });

  test("home aide sees the contacts and allergies, but not other people's numbers", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "access check; run once");
    await openLink(page, seeded.links.aide, seeded.circleId);
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    await expect(page.getByRole("region", { name: "Emergency contacts" }).getByRole("link", { name: /Call Marco Ruiz/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Allergies" }).getByText("Shellfish")).toBeVisible();
    // People: a home aide sees only the caregiver on the list, never the other people or their numbers.
    await expect(page.getByRole("link", { name: "Call Lena Ortiz, 555-010-0100" })).toBeVisible();
    await expect(page.getByText("555-010-0199")).toHaveCount(0);
    await expect(page.getByText("Paul Ruiz")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your phone number" })).toBeVisible();
  });

  test("a person with the care summary hidden sees no contacts or allergies, only people", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "access check; run once");
    await openLink(page, seeded.links.hidden, seeded.circleId);
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    await expect(page.getByRole("heading", { name: "People in the circle" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Emergency contacts" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Allergies" })).toHaveCount(0);
    await expect(page.getByText("Penicillin")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Call Joy Banda, 555-010-0188" })).toBeVisible();
  });

  test("prints without the menu, buttons or forms", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "print check; run once");
    await openLink(page, seeded.links.family, seeded.circleId);
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    await page.emulateMedia({ media: "print" });
    for (const nav of await page.locator('nav[aria-label="Circle areas"]').all()) await expect(nav).toBeHidden();
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Your phone number" })).toBeHidden();
    // The numbers print as plain numbers.
    await expect(page.getByText("(555) 010-0177")).toBeVisible();
    await expect(page.getByRole("region", { name: "Allergies" }).getByText("Penicillin")).toBeVisible();
  });

  test("caregiver: add, add from the circle and remove emergency contacts right on the page", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "signed-in flow; run once");
    await signInAsCaregiver(page, seeded.ownerSession);
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    const contacts = page.getByRole("region", { name: "Emergency contacts" });
    await expect(contacts.getByText("Marco Ruiz")).toBeVisible();
    // Allergies still open just that part of the care summary, and come back here.
    await expect(page.getByRole("link", { name: "Change allergies" })).toHaveAttribute("href", `/circles/${seeded.circleId}/summary/edit?part=allergies&from=emergency`);

    // Typed in here: a name, who they are and a number. A number that is not one is refused.
    await contacts.getByRole("button", { name: "Add an emergency contact" }).click();
    const form = contacts.getByRole("form", { name: "Add an emergency contact" });
    await form.getByLabel("Name").fill("Lucia Ruiz");
    await form.getByLabel(/Who they are/).fill("Niece");
    await form.getByLabel("Phone").fill("12");
    await form.getByRole("button", { name: "Save contact" }).click();
    await expect(contacts.getByRole("alert")).toBeVisible();
    await form.getByLabel("Phone").fill("555-010-0155");
    await form.getByRole("button", { name: "Save contact" }).click();
    await expect(contacts.getByText("Lucia Ruiz was added.")).toBeVisible();
    await expect(contacts.getByRole("link", { name: /Call Lucia Ruiz/ })).toBeVisible();
    await expect(contacts.getByText("Niece")).toBeVisible();

    // Someone in the circle with a number, in one tap.
    await contacts.getByRole("button", { name: "Joy Banda", exact: true }).click();
    await expect(contacts.getByText("Joy Banda was added.")).toBeVisible();
    await expect(contacts.getByRole("link", { name: /Call Joy Banda/ })).toBeVisible();
    await expect(contacts.getByRole("button", { name: "Joy Banda", exact: true })).toHaveCount(0);

    // Removed, and the page still lists the rest.
    await contacts.getByRole("button", { name: "Remove Lucia Ruiz from emergency contacts" }).click();
    await expect(contacts.getByText("Lucia Ruiz was removed.")).toBeVisible();
    await expect(contacts.getByRole("link", { name: /Call Lucia Ruiz/ })).toHaveCount(0);
    await expect(contacts.getByText("Marco Ruiz")).toBeVisible();

    // A person with a link sees the contacts, but no way to change them.
    const other = await page.context().browser()!.newContext();
    const helper = await other.newPage();
    await openLink(helper, seeded.links.family, seeded.circleId);
    await helper.goto(`/circles/${seeded.circleId}/emergency`);
    await expect(helper.getByRole("region", { name: "Emergency contacts" }).getByText("Joy Banda")).toBeVisible();
    await expect(helper.getByRole("button", { name: "Add an emergency contact" })).toHaveCount(0);
    await expect(helper.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await other.close();
  });

  test("signed out, the page asks to sign in", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "access check; run once");
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    await page.waitForURL(/\/login\?next=/);
  });
});
