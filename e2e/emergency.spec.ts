import { createHash, createHmac, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Emergency page and phone numbers, opened through people's own links. A fictional circle is
 * written straight into the test database (the same one the app under test uses, from .env.local),
 * and each person's link is worked out the way the app does it. Skipped when that database is not
 * set up here. Everything is removed afterwards.
 */
loadEnvConfig(process.cwd());
const URL_ = process.env.SUPABASE_URL ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const HELPER_SECRET = process.env.HELPER_SESSION_SECRET ?? "";
const SALT = process.env.IP_HASH_SALT ?? "";
const ready = Boolean(URL_ && SERVICE && HELPER_SECRET);

const tokenFor = (memberId: string) => createHmac("sha256", HELPER_SECRET).update(`ahc-member-link:${memberId}:1`).digest("base64url").slice(0, 24);
const hashOf = (token: string) => createHash("sha256").update([SALT, "invite", token].join(":")).digest("hex");

/** The test database's REST and admin endpoints, with the service key. */
async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

type Seeded = { circleId: string; ownerId: string; links: Record<"family" | "aide" | "hidden", string> };

async function seed(): Promise<Seeded> {
  const user = await rest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: `emergency.${randomUUID()}@example.com`, email_confirm: true, user_metadata: { name: "Lena Ortiz" } }),
  });
  const ownerId = user.id as string;
  const circleId = randomUUID();
  const content = {
    person_name: "Teodora Ruiz",
    allergies: ["Penicillin", "Shellfish"],
    doctors: [],
    emergency_contacts: [
      { name: "Marco Ruiz", relationship: "Son", phone: "(555) 010-0177" },
      { name: "Sunny Hills Clinic", relationship: "After-hours line" },
    ],
  };
  await rest("/rest/v1/circles", { method: "POST", body: JSON.stringify({ id: circleId, owner_id: ownerId, content }) });
  // No caregiver row: only the caregiver can write one (create_circle). The signed-in walk covers the caregiver's number.
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
  return { circleId, ownerId, links: { family: tokenFor(ids.family), aide: tokenFor(ids.aide), hidden: tokenFor(ids.hidden) } };
}

async function openLink(page: Page, token: string, circleId: string) {
  await page.goto(`/i/${token}`);
  await page.waitForURL(`**/circles/${circleId}`);
}

test.describe("Emergency page and phone numbers, through people's links", () => {
  test.skip(!ready, "needs the test database from .env.local");
  let seeded: Seeded;

  test.beforeAll(async () => {
    seeded = await seed();
  });

  test.afterAll(async () => {
    if (!seeded) return;
    await rest(`/rest/v1/circles?id=eq.${seeded.circleId}`, { method: "DELETE" });
    await rest(`/auth/v1/admin/users/${seeded.ownerId}`, { method: "DELETE" });
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
    await expect(people.getByRole("link", { name: "Call Joy Banda, 555-010-0188" })).toHaveAttribute("href", "tel:5550100188");
    // Nobody without a number, and nobody is offered a call to themselves.
    await expect(people.getByText("Ivy Chen")).toHaveCount(0);
    await expect(people.getByText("Ana Ruiz")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Allergies" }).getByText("Penicillin")).toBeVisible();

    // Their own number, from their link.
    const own = page.getByLabel(/Your number/);
    await own.fill("12");
    await page.getByRole("button", { name: "Save number" }).click();
    await expect(page.getByRole("alert")).toContainText("Enter a phone number");
    await own.fill("555-010-0166");
    await page.getByRole("button", { name: "Save number" }).click();
    await expect(page.getByText("Number saved.")).toBeVisible();
    const saved = await rest(`/rest/v1/members?select=phone&circle_id=eq.${seeded.circleId}&name=eq.Ana%20Ruiz`);
    expect(saved[0].phone).toBe("555-010-0166");
    await own.fill("");
    await page.getByRole("button", { name: "Remove number" }).click();
    await expect(page.getByText("Number removed.")).toBeVisible();

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

  test("signed out, the page asks to sign in", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "access check; run once");
    await page.goto(`/circles/${seeded.circleId}/emergency`);
    await page.waitForURL(/\/login\?next=/);
  });
});
