import { expect, test, type Page } from "@playwright/test";

/**
 * The "Add to Home Screen" button in the top bar (the scan page's bar here, which needs no sign-in).
 * A browser with its own install prompt gets the prompt in one tap; iPhone gets the steps and
 * "I added it"; Android before Chrome offers its prompt gets the menu steps. Opened from the Home
 * Screen, there is no button.
 */

/** The button only appears after the page loads (the server cannot know the device), so a "no button" check waits for that. */
async function hydrated(page: Page) {
  await expect(page.getByRole("heading", { name: "Scan after-visit summary" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

/** Chrome's install prompt, as the page sees it, recording whether it was shown. */
async function offerPrompt(page: Page, outcome: "accepted" | "dismissed") {
  await page.evaluate((answer) => {
    const event = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    event.prompt = async () => {
      (window as unknown as { prompted: boolean }).prompted = true;
    };
    event.userChoice = Promise.resolve({ outcome: answer });
    window.dispatchEvent(event);
  }, outcome);
}

test("the browser's own prompt in one tap; gone once installed", async ({ page }, info) => {
  test.skip(info.project.name === "iphone-safari", "iPhone has no install prompt for websites");
  await page.goto("/new");
  const button = page.getByRole("button", { name: "Add to Home Screen" });
  if (info.project.name === "desktop-chrome") await expect(button).toHaveCount(0);
  await offerPrompt(page, "accepted");
  await button.click();
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await expect(button).toHaveCount(0);
  // Remembered on this browser, once the page has loaded and checked.
  await page.reload();
  await hydrated(page);
  await expect(button).toHaveCount(0);
});

test("Android before Chrome offers its prompt: the menu steps", async ({ page }, info) => {
  test.skip(info.project.name !== "android-chrome", "Android only");
  await page.goto("/new");
  await page.getByRole("button", { name: "Add to Home Screen" }).click();
  const sheet = page.getByRole("dialog", { name: "Add to your Home Screen" });
  await expect(sheet).toContainText("In Chrome, tap the menu");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});

test("iPhone: the steps, and I added it hides the button", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-safari", "iPhone only");
  await page.goto("/new");
  const button = page.getByRole("button", { name: "Add to Home Screen" });
  await button.click();
  const sheet = page.getByRole("dialog", { name: "Add to your Home Screen" });
  await expect(sheet).toContainText("Add to Home Screen");
  await sheet.getByRole("button", { name: "I added it" }).click();
  await expect(button).toHaveCount(0);
});

test("opened from the Home Screen: no button", async ({ page }, info) => {
  test.skip(info.project.name === "desktop-chrome", "phones");
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    const standalone = { matches: true, media: "(display-mode: standalone)", onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
    window.matchMedia = (query: string) => (query.includes("display-mode: standalone") ? (standalone as unknown as MediaQueryList) : real(query));
  });
  await page.goto("/new");
  await hydrated(page);
  await expect(page.getByRole("button", { name: "Add to Home Screen" })).toHaveCount(0);
});
