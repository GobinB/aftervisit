import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function audit(page: Page, label: string) {
  await page.waitForTimeout(600); // let fade-in animations settle so contrast is measured on final colors
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(summary, label).toEqual([]);
}

test("no WCAG 2.1 AA violations on any screen", async ({ page }, info) => {
  test.skip(info.project.name === "iphone-safari", "axe runs in Chromium projects");
  await page.goto("/");
  await audit(page, "home");
  await page.goto("/new");
  await audit(page, "intake");
  await page.getByRole("button", { name: "Paste the text instead" }).click();
  await audit(page, "intake paste");
  await page.goto("/privacy");
  await audit(page, "privacy");
  await page.goto("/h/demo");
  await audit(page, "handoff demo");
  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample visit" }).first().click();
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  await audit(page, "review");
  await page.getByRole("region", { name: /Next steps/ }).getByRole("button", { name: "See it in the original" }).first().click();
  await expect(page.getByText("Look for this line")).toBeVisible();
  await audit(page, "review, original marked");
  if (await page.getByRole("button", { name: "Back to the draft" }).isVisible()) await page.getByRole("button", { name: "Back to the draft" }).click();
  await page.getByRole("button", { name: "Medicines look right" }).click();
  await audit(page, "review, second step");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "The rest looks right" }).click();
  await expect(page.getByRole("heading", { name: "Who should see this?" })).toBeVisible();
  await page.getByRole("switch", { name: "Protect with a 4-digit PIN" }).click();
  await audit(page, "share");
  await page.goto("/h/AAAAAAAAAAAAAAAAAAAAA");
  await audit(page, "not found handoff");
});

test("keyboard only: sample visit reaches Share", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chrome", "keyboard check on desktop");
  await page.goto("/");
  // Tab to the sample button and press Enter.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement?.textContent)) === "Try a sample visit") break;
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review the draft" })).toBeVisible();
  // Two confirms, both reachable by keyboard. The same button holds each in turn.
  for (const label of ["Medicines look right", "The rest looks right"]) {
    for (let i = 0; i < 300; i++) {
      if ((await page.evaluate(() => document.activeElement?.textContent)) === label) break;
      await page.keyboard.press("Tab");
    }
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(label);
    // Focus ring is visible on the focused element.
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).not.toBe("none");
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");
  }
  await expect(page.getByRole("heading", { name: "Who should see this?" })).toBeVisible();
});

test("no WCAG 2.1 AA violations on a personal link and the manage dashboard", async ({ page }, info) => {
  test.skip(info.project.name === "iphone-safari", "axe runs in Chromium projects");
  const { sampleDraft, SAMPLE_RECIPIENTS } = await import("../lib/sample");
  const r = Math.floor(Math.random() * 250) + 1;
  const res = await page.request.post("/api/handoffs", {
    headers: { "x-forwarded-for": `10.9.${r}.${r}` },
    data: { draft: sampleDraft(), recipients: SAMPLE_RECIPIENTS, createdByFirstName: "Jordan", consent: true },
  });
  expect(res.status()).toBe(201);
  const c = await res.json();
  await page.goto(new URL(c.invites[0].url).pathname);
  await expect(page.getByRole("heading", { name: "Margaret's visit on Oct 3" })).toBeVisible();
  await audit(page, "personal link");
  await page.goto(new URL(c.manageUrl).pathname + new URL(c.manageUrl).search);
  await expect(page.getByRole("heading", { name: "Your care handoff at a glance" })).toBeVisible();
  await audit(page, "manage dashboard");
  await page.request.delete(`/api/handoffs/${c.token}`, { headers: { "x-manage-key": c.manageKey } });
});
