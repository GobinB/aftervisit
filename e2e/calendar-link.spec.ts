import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

// Medicines in the calendar link. The calendar file is checked through its real address with a
// circle written straight to the database (fictional), and the subscribe page as its caregiver.
// Needs SUPABASE_URL, the anon and service role keys in .env.local, pointing at a local stack.

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const API = env.SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" };

type Seeded = { userId: string; email: string; password: string; circleId: string };

/** A fictional caregiver with one circle and four medicines: daily, some weekdays, as needed and stopped. */
async function seed(request: APIRequestContext): Promise<Seeded> {
  const email = `calendar.${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  const user = await request.post(`${API}/auth/v1/admin/users`, {
    headers: admin,
    data: { email, password, email_confirm: true, user_metadata: { name: "Lisa Ward" } },
  });
  expect(user.ok()).toBe(true);
  const userId = (await user.json()).id as string;
  const circle = await request.post(`${API}/rest/v1/circles`, {
    headers: { ...admin, prefer: "return=representation" },
    data: { owner_id: userId, content: { person_name: "Rosa Delgado" } },
  });
  expect(circle.ok()).toBe(true);
  const circleId = (await circle.json())[0].id as string;
  const meds = await request.post(`${API}/rest/v1/medications`, {
    headers: admin,
    // A bulk insert needs the same keys on every row.
    data: [
      { name: "Metformin", dose: "500 mg", amount: "1 tablet", schedule: "daily", times: ["08:00", "20:00"], start_date: "2026-11-02", reason: "Blood sugar" },
      { name: "Vitamin B12", dose: "1000 mcg", schedule: "weekdays", weekdays: [1, 4], times: ["09:30"], start_date: "2026-11-02" },
      { name: "Acetaminophen", dose: "500 mg", schedule: "as_needed", times: [] },
      { name: "Naproxen", dose: "220 mg", schedule: "daily", times: ["12:00"], start_date: "2026-10-01", status: "stopped", stop_date: "2026-11-05" },
    ].map((row) => ({
      circle_id: circleId,
      amount: null,
      weekdays: null,
      start_date: null,
      reason: null,
      status: "active",
      stop_date: null,
      ...row,
    })),
  });
  expect(meds.ok(), await meds.text()).toBe(true);
  return { userId, email, password, circleId };
}

async function addFeed(request: APIRequestContext, s: Seeded, includeMedicines?: boolean): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const row = { circle_id: s.circleId, token, created_by: s.userId, ...(includeMedicines === undefined ? {} : { include_medicines: includeMedicines }) };
  expect((await request.post(`${API}/rest/v1/calendar_feeds`, { headers: admin, data: row })).ok()).toBe(true);
  return token;
}

/**
 * Signs the caregiver in with a password on the local stack and makes them the circle's caregiver
 * (only they can add themselves). False when that stack has email sign-in off.
 */
async function signIn(context: BrowserContext, request: APIRequestContext, s: Seeded): Promise<boolean> {
  let captured: { name: string; value: string }[] = [];
  const client = createServerClient(API, ANON, { cookies: { getAll: () => [], setAll: (list) => void (captured = list) } });
  const { data, error } = await client.auth.signInWithPassword({ email: s.email, password: s.password });
  if (error || !data.session) return false;
  const own = { apikey: ANON, authorization: `Bearer ${data.session.access_token}`, "content-type": "application/json" };
  const row = await request.post(`${API}/rest/v1/circle_caregivers`, { headers: own, data: { circle_id: s.circleId, user_id: s.userId, role: "owner" } });
  expect(row.ok(), await row.text()).toBe(true);
  await context.addCookies(captured.filter((c) => c.value).map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const })));
  return true;
}

/** Unfolded lines of the entries whose UID starts with the prefix. */
function entries(ics: string, uidPrefix: string): string[][] {
  return ics
    .replace(/\r\n /g, "")
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((block) => block.split("\r\n").filter(Boolean))
    .filter((lines) => lines.some((line) => line.startsWith(`UID:${uidPrefix}`)));
}

test("the calendar file carries medicine times, and leaves them out when switched off", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "API-level check; run once");
  const s = await seed(page.request);
  const token = await addFeed(page.request, s);

  const response = await page.request.get(`/api/calendar/${token}.ics`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/calendar");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const ics = await response.text();
  expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);

  const metformin = entries(ics, "med-").filter((lines) => lines.includes("SUMMARY:Metformin · 500 mg · 1 tablet"));
  expect(metformin).toHaveLength(2);
  expect(metformin[0]).toContain("DTSTART:20261102T080000");
  expect(metformin[1]).toContain("DTSTART:20261102T200000");
  expect(metformin[0]).toContain("RRULE:FREQ=DAILY");

  const b12 = entries(ics, "med-").find((lines) => lines.some((l) => l.startsWith("SUMMARY:Vitamin B12")));
  expect(b12).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,TH");
  // November 2, 2026 is a Monday.
  expect(b12).toContain("DTSTART:20261102T093000");

  // Only when needed: no time, no entry. Stopped: ends the day before it was stopped.
  expect(ics).not.toContain("Acetaminophen");
  const naproxen = entries(ics, "med-").find((lines) => lines.some((l) => l.startsWith("SUMMARY:Naproxen")));
  expect(naproxen).toContain("RRULE:FREQ=DAILY;UNTIL=20261104T235959");
  // What the medicine is for stays with the circle.
  expect(ics).not.toContain("Blood sugar");

  // The caregiver leaves medicines out: the next read has none.
  const off = await page.request.patch(`${API}/rest/v1/calendar_feeds?circle_id=eq.${s.circleId}`, { headers: admin, data: { include_medicines: false } });
  expect(off.ok()).toBe(true);
  const without = await (await page.request.get(`/api/calendar/${token}.ics`)).text();
  expect(without).toContain("X-WR-CALNAME:Rosa Delgado's care");
  expect(entries(without, "med-")).toHaveLength(0);
  expect(without).not.toContain("Metformin");

  // Turned off: the address is gone.
  expect((await page.request.delete(`${API}/rest/v1/calendar_feeds?circle_id=eq.${s.circleId}`, { headers: admin })).ok()).toBe(true);
  expect((await page.request.get(`/api/calendar/${token}.ics`)).status()).toBe(404);
});

test("subscribe page: medicines switch, how soon changes show, and what the calendar company receives", async ({ page, context }) => {
  const s = await seed(page.request);
  test.skip(!(await signIn(context, page.request, s)), "Needs a local stack with email sign-in on, for a test password");

  await page.goto(`/circles/${s.circleId}/calendar/subscribe`);
  await expect(page.getByRole("heading", { name: "Add to your calendar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Calendar/ }).first()).toBeVisible();
  await expect(page.getByText(/Appointments, reminders and medicine times from this/)).toBeVisible();
  await page.getByRole("button", { name: "Turn on the calendar link" }).click();

  const toggle = page.getByRole("switch", { name: /Put medicine times in the calendar/ });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/receive each medicine's name, strength and times, and keep their own copy/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "How soon changes show" })).toBeVisible();
  for (const app of ["Google Calendar", "Apple Calendar", "Outlook"]) await expect(page.locator("dt", { hasText: app })).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);

  const feedUrl = async () => (await page.getByRole("link", { name: /Apple Calendar/ }).getAttribute("href"))!.replace(/^webcal:\/\/[^/]+/, "");
  expect(await (await page.request.get(await feedUrl())).text()).toContain("Metformin");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Off: only appointments and reminders")).toBeVisible();
  expect(await (await page.request.get(await feedUrl())).text()).not.toContain("Metformin");

  // The setting is kept, and a new link keeps it too.
  await page.reload();
  await expect(page.getByRole("switch", { name: /Put medicine times/ })).toHaveAttribute("aria-checked", "false");
  const before = await feedUrl();
  await page.getByRole("button", { name: "Make a new link" }).click();
  await page.getByRole("button", { name: "Yes, new link" }).click();
  await expect.poll(feedUrl).not.toBe(before);
  await expect(page.getByRole("switch", { name: /Put medicine times/ })).toHaveAttribute("aria-checked", "false");
  expect((await page.request.get(before)).status()).toBe(404);

  await page.getByRole("switch", { name: /Put medicine times/ }).click();
  await expect(page.getByRole("switch", { name: /Put medicine times/ })).toHaveAttribute("aria-checked", "true");
  expect(await (await page.request.get(await feedUrl())).text()).toContain("Metformin");

  // Nothing scrolls sideways, on a computer or a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("privacy pages say the calendar company receives medicine names and times, with the date", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "Text check; run once");
  await page.goto("/privacy");
  await expect(page.getByText(/With medicines on \(they are on unless you turn them off\), it also receives each medicine's name, strength/)).toBeVisible();
  await expect(page.getByText(/Latest change, \w+ \d+, \d{4}:.*the calendar link now carries medicine times/)).toBeVisible();
  await expect(page.getByText(/not\s+medicines/)).toHaveCount(0);
  await page.goto("/privacy/health-data");
  await expect(page.getByText(/unless you leave them out, medicine names, strengths and times/)).toBeVisible();
});
