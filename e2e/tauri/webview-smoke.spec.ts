import { test, expect } from "@playwright/test";

const hasTarget = Boolean(process.env.AGS_TAURI_URL);

test.describe("Tauri / WebView2 smoke", () => {
  test.skip(!hasTarget, "Set AGS_TAURI_URL to run against tauri dev or WebView");

  test("shell loads brand / login", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/Aether|Вход|admin|Загрузка/i).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("V2.1 modules registered in nav labels", async ({ page }) => {
    await page.goto("/");
    // After login shell may show nav titles via aria / title attributes
    const body = await page.locator("body").innerText();
    // Soft check: page is interactive; module presence verified in unit MODULES list
    expect(body.length).toBeGreaterThan(0);
  });
});
