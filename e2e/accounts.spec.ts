import { createHash, createHmac, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Optional sign-in for people in a circle. Ivy, a fictional care manager, helps in two circles run by
 * two fictional caregivers. She saves both links to her account, finds both in one place and
 * switches between them; a phone that opened her link before, and a forwarded copy of it, stop
 * opening it; someone signed in with another account is told so; the caregiver sees who signed in
 * and undoes it, and the old phone opens the link again; removing her ends both ways in.
 *
 * Everyone signs in with a password on the test database (Google cannot be automated), with the
 * session cookie the app's Supabase client writes. Skipped when that database is not set up here or
 * has password sign-in off. The circles are deleted afterwards.
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

type Session = Record<string, unknown> & { access_token: string };
type Person = { email: string; session: Session };

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
  return { email, session: (await res.json()) as Session };
}

async function circle(owner: Person, personName: string): Promise<string> {
  const consents = ["authorized_to_share", "terms", "privacy"].map((type) => ({ type, version: "2026-11-17", text_hash: createHash("sha256").update(type).digest("hex") }));
  return (await rest(
    "/rest/v1/rpc/create_circle",
    { method: "POST", body: JSON.stringify({ p_content: { person_name: personName, allergies: [], doctors: [], emergency_contacts: [] }, p_consents: consents }) },
    owner.session.access_token,
  )) as string;
}

/** A person with their own link, written the way the app writes them. Returns their link token. */
async function member(circleId: string, name: string, role: string): Promise<{ id: string; token: string }> {
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
    }),
  });
  return { id, token: tokenFor(id) };
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

async function openLink(page: Page, token: string, circleId: string) {
  await page.goto(`/i/${token}`);
  await page.waitForURL(`**/circles/${circleId}`);
}

type Seeded = {
  lena: Person;
  marco: Person;
  ivy: Person;
  teodora: string;
  walter: string;
  ivyAtTeodora: { id: string; token: string };
  ivyAtWalter: { id: string; token: string };
};

test.describe("signing in as a person in the circle", () => {
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
    const [ivyAtTeodora, ivyAtWalter] = await Promise.all([member(teodora, "Ivy Chen", "care_manager"), member(walter, "Ivy Chen", "family")]);
    seeded = { lena, marco, ivy, teodora, walter, ivyAtTeodora, ivyAtWalter };
  });

  test.beforeEach(() => {
    test.skip(Boolean(skip), skip);
  });

  test.afterAll(async () => {
    if (!seeded) return;
    await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.teodora }) }, seeded.lena.session.access_token);
    await rest("/rest/v1/rpc/delete_circle", { method: "POST", body: JSON.stringify({ p_circle: seeded.walter }) }, seeded.marco.session.access_token);
  });

  test("one person in two circles: save both links, one home, a switcher, and the link opens only for her", async ({ browser }) => {
    const { teodora, walter, ivyAtTeodora, ivyAtWalter, ivy, marco } = seeded;
    const phone = test.info().project.name !== "desktop-chrome";

    // Her old phone opened the link before she signed in anywhere.
    const old = await fresh(browser);
    await openLink(old.page, ivyAtTeodora.token, teodora);
    await expect(old.page.getByRole("heading", { name: "All your circles in one place" })).toBeVisible();

    // Her own phone: the link, then Save this to my account. Optional; nothing changes until she taps Save.
    const own = await fresh(browser);
    await openLink(own.page, ivyAtTeodora.token, teodora);
    await own.page.getByRole("link", { name: "Save this to my account" }).click();
    await own.page.waitForURL(`**/circles/${teodora}/account`);
    await expect(own.page.getByRole("heading", { name: "Save this to my account" })).toBeVisible();
    await expect(own.page.getByText("Your link keeps working as it is if you skip this.")).toBeVisible();
    await expect(own.page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await expect(own.page.getByRole("link", { name: "Back to Today" })).toBeVisible();

    // Google sends her back here signed in (a password session stands in for Google).
    await signIn(own.context, ivy);
    await own.page.reload();
    await expect(own.page.getByText(`Signed in as ${ivy.email}`)).toBeVisible();
    await own.page.getByRole("button", { name: "Save to my Google account" }).click();
    await expect(own.page.getByRole("heading", { name: "Saved to your account" })).toBeVisible();
    await expect(own.page.getByText("Your link now opens only when you are signed in with this account.")).toBeVisible();

    // The phone that opened the link before no longer gets in, and neither does a forwarded copy.
    await old.page.goto(`/circles/${teodora}`);
    await old.page.waitForURL(/\/login\?next=/);
    await old.page.goto(`/i/${ivyAtTeodora.token}`);
    await expect(old.page.getByRole("heading", { name: "Sign in to open this circle" })).toBeVisible();
    const forwarded = await fresh(browser);
    await forwarded.page.goto(`/i/${ivyAtTeodora.token}`);
    await expect(forwarded.page.getByRole("heading", { name: "Sign in to open this circle" })).toBeVisible();
    await expect(forwarded.page).toHaveURL(new RegExp(`/i/${ivyAtTeodora.token}$`));

    // Someone signed in with another account is told so, and shown only their own address.
    await signIn(forwarded.context, marco);
    await forwarded.page.reload();
    await expect(forwarded.page.getByRole("alert").filter({ hasText: "You are signed in as" })).toContainText(marco.email);
    await expect(forwarded.page.getByRole("button", { name: "Use another Google account" })).toBeVisible();
    await expect(forwarded.page.getByText(ivy.email)).toHaveCount(0);

    // The second circle: already signed in, so it is one tap.
    await openLink(own.page, ivyAtWalter.token, walter);
    await own.page.goto(`/circles/${walter}/account`);
    await own.page.getByRole("button", { name: "Save to my Google account" }).click();
    await expect(own.page.getByRole("heading", { name: "Saved to your account" })).toBeVisible();

    // One home for both. She runs nothing, so there is no start tile as if she did, but she can start her own.
    await own.page.goto("/circles");
    await expect(own.page.getByRole("heading", { name: "The people you help" })).toBeVisible();
    await expect(own.page.getByRole("link", { name: /Teodora Ruiz.*You help here · Care manager/ })).toBeVisible();
    await expect(own.page.getByRole("link", { name: /Walter Kim.*You help here · Family/ })).toBeVisible();
    await expect(own.page.getByRole("link", { name: "Start a care circle" })).toHaveCount(0);
    await expect(own.page.getByRole("link", { name: "Start your own care circle" })).toBeVisible();

    // The switcher at the top of a circle moves between them.
    await own.page.getByRole("link", { name: /Teodora Ruiz/ }).click();
    await own.page.waitForURL(`**/circles/${teodora}`);
    await own.page.locator('summary[aria-label="Switch circle. Now: Teodora Ruiz"]').filter({ visible: true }).first().click();
    await own.page.locator("details[open]").getByRole("link", { name: /Walter Kim/ }).click();
    await own.page.waitForURL(`**/circles/${walter}`);
    // Signed in, she sees what her role allows there, and nothing offers to save it again.
    await expect(own.page.getByRole("link", { name: "Save this to my account" })).toHaveCount(0);
    if (!phone) await expect(own.page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // On a new computer, signing in is enough: her link takes her straight in.
    const laptop = await fresh(browser);
    await signIn(laptop.context, ivy);
    await laptop.page.goto(`/i/${ivyAtTeodora.token}`);
    await laptop.page.waitForURL(`**/circles/${teodora}`);
    await laptop.page.goto("/start");
    await laptop.page.waitForURL(/\/circles(\/|$)/);

    await Promise.all([old.context.close(), own.context.close(), forwarded.context.close(), laptop.context.close()]);
  });

  test("the caregiver sees who signed in, can undo it, and removing the person ends both ways in", async ({ browser }) => {
    const { lena, ivy, teodora, walter, ivyAtTeodora } = seeded;

    const caregiver = await fresh(browser);
    await signIn(caregiver.context, lena);
    await caregiver.page.goto(`/circles/${teodora}/members`);
    const row = caregiver.page.getByRole("button", { name: /Ivy Chen/ });
    await expect(row).toContainText("Signed in");
    await row.click();
    await expect(caregiver.page.getByText(`Ivy signed in with Google as ${ivy.email}`)).toBeVisible();

    // Undo: the link opens on its own again, on a phone that opened it before.
    await caregiver.page.getByRole("button", { name: "Undo", exact: true }).click();
    await caregiver.page.getByRole("button", { name: "Yes, undo" }).click();
    await expect(row).not.toContainText("Signed in");
    const linkOnly = await fresh(browser);
    await openLink(linkOnly.page, ivyAtTeodora.token, teodora);
    await expect(linkOnly.page.getByRole("heading", { name: "All your circles in one place" })).toBeVisible();

    // Her account now lists only the circle still saved to it.
    const own = await fresh(browser);
    await signIn(own.context, ivy);
    await own.page.goto("/circles");
    await expect(own.page.getByRole("link", { name: /Walter Kim/ })).toBeVisible();
    await expect(own.page.getByRole("link", { name: /Teodora Ruiz/ })).toHaveCount(0);

    // She saves it again from that phone, then the caregiver removes her: neither her link nor her account opens it.
    await signIn(linkOnly.context, ivy);
    await linkOnly.page.goto(`/circles/${teodora}/account`);
    await linkOnly.page.getByRole("button", { name: "Save to my Google account" }).click();
    await expect(linkOnly.page.getByRole("heading", { name: "Saved to your account" })).toBeVisible();
    await caregiver.page.reload();
    await caregiver.page.getByRole("button", { name: /Ivy Chen/ }).click();
    await caregiver.page.getByRole("button", { name: "Remove", exact: true }).click();
    await caregiver.page.getByRole("button", { name: "Yes, remove Ivy" }).click();
    await expect(caregiver.page.getByRole("button", { name: /Ivy Chen/ })).toContainText("Removed");

    await linkOnly.page.goto(`/circles/${teodora}`);
    await linkOnly.page.waitForURL(/\/login\?next=/);
    await own.page.goto("/circles");
    await expect(own.page.getByRole("link", { name: /Teodora Ruiz/ })).toHaveCount(0);
    await own.page.goto(`/circles/${walter}`);
    await expect(own.page).toHaveURL(new RegExp(`/circles/${walter}$`));

    await Promise.all([caregiver.context.close(), linkOnly.context.close(), own.context.close()]);
  });
});
