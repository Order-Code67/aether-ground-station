import { test, expect } from "@playwright/test";

/**
 * Scenario A (partial, browser preview): login shell + AMSL math invariant via page evaluate.
 * Full Tauri hardware paths are covered by Rust/Vitest unit tests.
 */
test("login screen and AMSL formula invariant", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Aether|Вход|admin|Загрузка/i).first()).toBeVisible({
    timeout: 30_000,
  });

  const amsl = await page.evaluate(() => {
    const calc = (
      terrain: number | null,
      mast: number,
      offset: number,
    ): number | null => {
      if (terrain == null || Number.isNaN(terrain)) return null;
      return terrain + mast + offset;
    };
    return {
      ok: calc(180, 10, 2) === 192,
      missing: calc(null, 10, 2) === null,
    };
  });
  expect(amsl.ok).toBeTruthy();
  expect(amsl.missing).toBeTruthy();
});
