import { expect, test, type Page } from "@playwright/test";

/**
 * Google sign-in from the installed iPhone app opens Google in a window of the app. If that window
 * closes before sign-in finishes, the button comes back; "Start again" is there while it waits; and a
 * sign-in that finishes after the button came back still moves the page on. Google's window is a
 * stand-in here: the page only sees whether it is open.
 */

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-safari", "The Home Screen app is an iPhone case");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { get: () => true });
    const popup = {
      closed: false,
      close() {
        this.closed = true;
      },
    };
    const w = window as unknown as { googleWindow: typeof popup; opened: number };
    w.googleWindow = popup;
    w.opened = 0;
    window.open = () => {
      w.opened += 1;
      popup.closed = false;
      return popup as unknown as Window;
    };
  });
});

async function startSignIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(page.getByRole("button", { name: "Finishing sign-in" })).toBeDisabled();
  // Seen open by the page before anything else happens.
  await page.waitForTimeout(800);
}

test("Google's window closed before signing in: the button comes back", async ({ page }) => {
  await startSignIn(page);
  await page.evaluate(() => {
    (window as unknown as { googleWindow: { closed: boolean } }).googleWindow.closed = true;
  });

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
  await expect(page.getByText("The Google window closed before sign-in finished. Tap the button to try again.")).toBeVisible();

  // The timed session check stops once the button is back (it runs every 2.5 seconds while waiting).
  let checks = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/session") checks += 1;
  });
  await page.waitForTimeout(6000);
  expect(checks).toBe(0);

  // Trying again opens Google again and waits again.
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(page.getByRole("button", { name: "Finishing sign-in" })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { opened: number }).opened)).toBe(2);
});

test("Start again closes Google's window and brings the button back", async ({ page }) => {
  await startSignIn(page);
  await page.getByRole("button", { name: "Start again" }).click();

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();
  await expect(page.getByText("The Google window closed before sign-in finished.")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { googleWindow: { closed: boolean } }).googleWindow.closed)).toBe(true);
});

test("a sign-in that finishes after the window closed still moves the page on", async ({ page }) => {
  await startSignIn(page);
  await page.evaluate(() => {
    (window as unknown as { googleWindow: { closed: boolean } }).googleWindow.closed = true;
  });
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeEnabled();

  const moved = page.waitForRequest((request) => new URL(request.url()).pathname === "/start");
  await page.evaluate(() => {
    const channel = new BroadcastChannel("ahc-signed-in");
    channel.postMessage("signed-in");
    channel.close();
  });
  await moved;
});
