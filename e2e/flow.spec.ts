import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_SOURCE_TEXT, sampleDraft, SAMPLE_RECIPIENTS } from "../lib/sample";

/** Each test gets its own fake client IP so the hourly rate limits never collide. */
async function isolateIp(page: Page) {
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  await page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }));
  return ip;
}
const rand = () => Math.floor(Math.random() * 250) + 1;

async function checkAllSections(page: Page) {
  const boxes = page.getByRole("checkbox", { name: "I've reviewed this section" });
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  return n;
}

async function createViaApi(page: Page, opts: { pin?: string } = {}) {
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  const res = await page.request.post("/api/handoffs", {
    headers: { "x-forwarded-for": ip },
    data: { draft: sampleDraft(), recipients: SAMPLE_RECIPIENTS, pin: opts.pin, createdByFirstName: "Gobin" },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { token: string; manageKey: string; shareUrl: string; manageUrl: string };
}

test("sample visit: home to acknowledged handoff, manage, delete", async ({ page }) => {
  const started = Date.now();
  await isolateIp(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start with a sample visit" }).first().click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();

  const confirm = page.getByRole("link", { name: "Confirm and create handoff" });
  await expect(page.getByRole("button", { name: "Confirm and create handoff" })).toBeDisabled();
  expect(await checkAllSections(page)).toBe(5);
  await confirm.click();

  await expect(page.getByRole("heading", { name: "Who should see this?" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true }).first()).toHaveValue("Lisa");
  await page.getByRole("button", { name: "Create handoff" }).click();
  await expect(page.getByText("Your handoff is ready. Only people with this link can see it.")).toBeVisible();

  const shareUrl = await page.getByLabel("Share link").inputValue();
  const manageUrl = await page.getByLabel("Manage link").inputValue();
  expect(shareUrl).toMatch(/\/h\/[A-Za-z0-9_-]{21}$/);
  expect(manageUrl).toMatch(/\/manage\?key=[A-Za-z0-9_-]{32}$/);
  // Text / Email links are prefilled.
  expect(await page.getByRole("link", { name: "Text it" }).getAttribute("href")).toContain(encodeURIComponent("Care update for Margaret"));
  expect(await page.getByRole("link", { name: "Email it" }).getAttribute("href")).toContain("mailto:?subject=");

  // Recipient opens the link with no cookies and no login.
  const recipient = await page.context().browser()!.newContext({ ...test.info().project.use });
  const rp = await recipient.newPage();
  await rp.goto(shareUrl);
  await expect(rp.getByRole("heading", { name: "Margaret's visit on Oct 3" })).toBeVisible();
  await expect(rp.getByText("Dr. Anita Patel, Internal Medicine")).toBeVisible();
  await expect(rp.getByRole("heading", { name: "For Lisa" })).toBeVisible();
  await rp.getByLabel("Your name").fill("Lisa");
  await rp.getByRole("button", { name: "I've read this" }).click();
  await expect(rp.getByText("Thanks, Lisa. Gobin will see that you've read this.")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(120_000);

  // Creator sees the acknowledgment.
  await page.goto(manageUrl);
  await expect(page.getByRole("heading", { name: "Manage this handoff" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Read by (1)" })).toBeVisible();
  await expect(page.getByText("Lisa", { exact: true }).first()).toBeVisible();

  // Delete removes it immediately.
  await page.getByRole("button", { name: "Delete this handoff" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "This care update was deleted" })).toBeVisible();
  await rp.goto(shareUrl);
  await expect(rp.getByText("This care update was deleted by the person who created it.")).toBeVisible();
  await recipient.close();
});

test("pasted text reaches Review in under 3 seconds", async ({ page }) => {
  await isolateIp(page);
  await page.goto("/new");
  await page.getByRole("button", { name: "Paste the text instead" }).click();
  await page.getByLabel("Paste the summary text").fill(readFileSync("tests/fixtures/cerner.txt", "utf8"));
  await page.getByLabel(/Who was the visit for/).fill("Rose");
  const t0 = Date.now();
  await page.getByRole("button", { name: "Build the handoff" }).click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(3500);
  const meds = page.getByRole("region", { name: /Medication changes/ });
  await expect(meds.getByText("Furosemide")).toBeVisible();
  await expect(meds.getByText("Potassium Chloride")).toBeVisible();
});

test("text-based PDF upload produces a draft", async ({ page }) => {
  await isolateIp(page);
  await page.goto("/new");
  await page.locator('input[type="file"]').setInputFiles("public/sample-avs.pdf");
  await expect(page.getByText("sample-avs.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Build the handoff" }).click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  const meds = page.getByRole("region", { name: /Medication changes/ });
  await expect(meds.getByText("Lisinopril")).toBeVisible();
  await expect(meds.getByText("Meclizine")).toBeVisible();
});

test("scanned PDF shows the take-a-photo suggestion", async ({ page }) => {
  await isolateIp(page);
  // An image-only PDF: no text layer.
  const maker = await page.context().newPage();
  await maker.setContent(`<div style="width:600px;height:300px;background:linear-gradient(90deg,#333,#ccc)"></div>`);
  const pdf = await (async () => {
    try {
      return await maker.pdf();
    } catch {
      return null;
    }
  })();
  await maker.close();
  test.skip(!pdf, "page.pdf() is only available in Chromium");
  await page.goto("/new");
  await page.locator('input[type="file"]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: pdf! });
  await page.getByRole("button", { name: "Build the handoff" }).click();
  await expect(page.getByText(/This PDF looks like a scan/)).toBeVisible();
});

test("unsupported file type is rejected with the friendly message", async ({ page }) => {
  await page.goto("/new");
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.docx", mimeType: "application/msword", buffer: Buffer.from("x") });
  await expect(page.getByText(/That file type is not supported yet/)).toBeVisible();
});

test("photo is read in the browser; only text is sent", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "OCR is slow; run once");
  test.setTimeout(150_000);
  await isolateIp(page);
  // Render the sample summary as a "photo".
  const maker = await page.context().newPage();
  await maker.setViewportSize({ width: 1000, height: 1300 });
  await maker.setContent(
    `<pre style="font: 22px/1.5 Helvetica, Arial; white-space: pre-wrap; padding: 40px; color:#111; background:#fff">${SAMPLE_SOURCE_TEXT.replace(/</g, "&lt;")}</pre>`,
  );
  const png = await maker.screenshot({ fullPage: true });
  await maker.close();

  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) bodies.push(`${r.headers()["content-type"]}`);
  });

  await page.goto("/new");
  await page.locator('input[type="file"]').setInputFiles({ name: "avs-photo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Build the handoff" }).click();
  await expect(page.getByRole("progressbar", { name: "Reading the photo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("region", { name: /Medication changes/ }).getByText("Lisinopril")).toBeVisible();
  expect(bodies.length).toBe(1);
  expect(bodies[0]).toContain("application/json");
});

test("low-confidence items block the section until accepted", async ({ page }) => {
  await isolateIp(page);
  await page.goto("/new");
  await page.getByRole("button", { name: "Paste the text instead" }).click();
  await page.getByLabel("Paste the summary text").fill(readFileSync("tests/fixtures/urgent-care.txt", "utf8"));
  await page.getByRole("button", { name: "Build the handoff" }).click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  const meds = page.getByRole("region", { name: /Medication changes/ });
  await expect(meds.getByText("Please check this", { exact: true })).toBeVisible();
  await expect(meds.getByRole("checkbox")).toBeDisabled();
  await meds.getByRole("button", { name: "Accept" }).click();
  await expect(meds.getByRole("checkbox")).toBeEnabled();
});

test("delete with undo, and edits persist across sections", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start with a sample visit" }).first().click();
  const meds = page.getByRole("region", { name: /Medication changes/ });
  await meds.getByRole("button", { name: "Delete Meclizine" }).click();
  await expect(meds.getByText("Meclizine")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(meds.getByText("Meclizine")).toBeVisible();

  await meds.getByRole("button", { name: "Edit Atorvastatin" }).click();
  await meds.getByLabel("How to take it").fill("40 mg at bedtime");
  await meds.getByRole("button", { name: "Save" }).click();
  await page.getByRole("region", { name: /Watch for/ }).getByRole("button", { name: "Edit Watch-for item" }).first().click();
  await page.keyboard.press("Escape");
  await expect(meds.getByText("40 mg at bedtime")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: /Medication changes/ }).getByText("40 mg at bedtime")).toBeVisible();
});

test("PIN: wrong attempts count down, correct PIN opens, PIN never in URL", async ({ page }) => {
  const h = await createViaApi(page, { pin: "4821" });
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(`/h/${h.token}`);
  await expect(page.getByRole("heading", { name: "Enter the 4-digit PIN" })).toBeVisible();
  await page.getByLabel("PIN, digit 1 of 4").pressSequentially("1111");
  await expect(page.getByText("That PIN does not match. 2 attempts left.")).toBeVisible();
  await page.getByLabel("PIN, digit 1 of 4").pressSequentially("4821");
  await expect(page.getByRole("heading", { name: "Margaret's visit on Oct 3" })).toBeVisible();
  expect(urls.some((u) => u.includes("4821"))).toBe(false);
  // Acknowledging re-sends the PIN in the body.
  await page.getByLabel("Your name").fill("Rosa");
  await page.getByRole("button", { name: "I've read this" }).click();
  await expect(page.getByText("Thanks, Rosa.")).toBeVisible();
});

test("PIN: three wrong attempts lock for 10 minutes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "API-level check; run once");
  const h = await createViaApi(page, { pin: "1234" });
  for (const [pin, status] of [
    ["0000", 401],
    ["0001", 401],
    ["0002", 423],
    ["1234", 423],
  ] as const) {
    const r = await page.request.post(`/api/handoffs/${h.token}`, { data: { pin } });
    expect(r.status(), `pin ${pin}`).toBe(status);
  }
  await page.goto(`/h/${h.token}`);
  await page.getByLabel("PIN, digit 1 of 4").pressSequentially("1234");
  await expect(page.getByText("Too many attempts. Try again in 10 minutes.")).toBeVisible();
});

test("no horizontal scroll at 360 px; buttons at least 48 px", async ({ page }, info) => {
  test.skip(info.project.name === "desktop-chrome", "mobile check");
  await page.setViewportSize({ width: 360, height: 760 });
  for (const path of ["/", "/new", "/h/demo", "/privacy"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Start with a sample visit" }).first().click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const box = await page.getByRole("button", { name: "Confirm and create handoff" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
});

test("demo handoff: large text toggle persists, print view hides chrome", async ({ page }) => {
  await page.goto("/h/demo");
  const before = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  await page.getByRole("button", { name: "Large text" }).click();
  const after = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(after / before).toBeCloseTo(1.2, 1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Large text" })).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "I've read this" })).toBeHidden();
  await expect(page.getByText("Reviewed by:")).toBeVisible();
});

test("security headers and noindex on /h routes", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "API-level check; run once");
  const res = await page.request.get("/h/demo");
  const h = res.headers();
  expect(h["x-robots-tag"]).toContain("noindex");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  const html = await res.text();
  expect(html).toContain('name="robots" content="noindex, nofollow');
  // The Supabase keys never reach the browser bundle.
  expect(html).not.toMatch(/eyJhbGci|sb_secret_|sb_publishable_/);
});

test("abuse: the 11th extract in an hour returns a friendly 429", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "API-level check; run once");
  const ip = `10.${rand()}.${rand()}.${rand()}`;
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) {
    const r = await page.request.post("/api/extract", { headers: { "x-forwarded-for": ip }, data: { text: SAMPLE_SOURCE_TEXT } });
    statuses.push(r.status());
    if (i === 10) expect((await r.json()).message).toMatch(/wait a little/);
  }
  expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
  expect(statuses[10]).toBe(429);
});

test("cron purge requires the bearer secret and removes expired rows", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "API-level check; run once");
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  expect((await page.request.get("/api/cron/purge")).status()).toBe(401);
  expect((await page.request.get("/api/cron/purge", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);

  const h = await createViaApi(page);
  // Backdate the row so it has expired.
  const patch = await page.request.patch(`${env.SUPABASE_URL}/rest/v1/handoffs?token=eq.${h.token}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" },
    data: { expires_at: new Date(Date.now() - 60_000).toISOString() },
  });
  expect(patch.ok()).toBe(true);
  // Expired rows are never served, even before the purge runs.
  expect((await page.request.get(`/api/handoffs/${h.token}`)).status()).toBe(410);

  const run = await page.request.get("/api/cron/purge", { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
  expect(run.status()).toBe(200);
  expect((await run.json()).purged).toBeGreaterThanOrEqual(1);
  const gone = await page.request.get(`/api/handoffs/${h.token}`);
  expect(gone.status()).toBe(410);
  expect((await gone.json()).status).toBe("expired");
  await page.goto(`/h/${h.token}`);
  await expect(page.getByText(/This care update has expired/)).toBeVisible();
});

test("attached original: served through a checked link, gone the moment the handoff is deleted", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "storage check; run once");
  await isolateIp(page);
  await page.goto("/new");
  await page.locator('input[type="file"]').setInputFiles("public/sample-avs.pdf");
  await page.getByLabel("Your first name").fill("Gobin");
  await page.getByRole("button", { name: "Build the handoff" }).click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  // The PDF path flags nothing low-confidence for the sample; check every section.
  for (const accept of await page.getByRole("button", { name: "Accept" }).all()) await accept.click();
  await checkAllSections(page);
  await page.getByRole("link", { name: "Confirm and create handoff" }).click();
  await page.getByLabel("Name", { exact: true }).first().fill("Rosa");
  await page.getByRole("radio", { name: "Home aide" }).click();
  await page.getByRole("switch", { name: "Attach the original summary" }).click();
  await page.getByRole("button", { name: "Create handoff" }).click();
  await expect(page.getByText("Your handoff is ready.")).toBeVisible();
  const shareUrl = await page.getByLabel("Share link").inputValue();
  const manageUrl = await page.getByLabel("Manage link").inputValue();

  await page.goto(shareUrl);
  const link = page.getByRole("link", { name: /View the clinic's original summary/ });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  expect(href).toMatch(/^\/api\/handoffs\/[A-Za-z0-9_-]{21}\/original\?ticket=\d{10}\.[0-9a-f]{32}$/);
  const file = await page.request.get(href);
  expect(file.status()).toBe(200);
  expect((await file.body()).subarray(0, 4).toString()).toBe("%PDF");
  // The redirect target is a short-lived Supabase URL, never handed out directly.
  const hop = await page.request.get(href, { maxRedirects: 0 });
  expect(hop.status()).toBe(302);
  expect(hop.headers()["location"]).toContain("/storage/v1/object/sign/originals/");

  await page.goto(manageUrl);
  await expect(page.getByText("Attached", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete this handoff" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "This care update was deleted" })).toBeVisible();
  // The object is gone from storage.
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const token = shareUrl.split("/h/")[1];
  const list = await page.request.post(`${env.SUPABASE_URL}/storage/v1/object/list/originals`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    data: { prefix: `${token}/`, limit: 10 },
  });
  expect(await list.json()).toEqual([]);
  // The recipient's link stops working immediately.
  expect((await page.request.get(href, { maxRedirects: 0 })).status()).toBe(410);
});

test("attach switch is hidden when the summary was pasted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start with a sample visit" }).first().click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  await checkAllSections(page);
  await page.getByRole("link", { name: "Confirm and create handoff" }).click();
  await expect(page.getByRole("heading", { name: "Who should see this?" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Attach the original summary" })).toHaveCount(0);
});
