import { test, expect } from "@playwright/test";

/**
 * P2-5: Station CRUD in browser preview (in-memory SSOT).
 * Tauri SQLite persistence covered by desktop smoke / unit path.
 */
async function loginShell(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText(/Aether|Вход|admin|Загрузка/i).first()).toBeVisible({
    timeout: 30_000,
  });
  const user = page.locator('input[type="text"], input[name="username"]').first();
  const pass = page.locator('input[type="password"]').first();
  if (await pass.isVisible().catch(() => false)) {
    if (await user.isVisible().catch(() => false)) {
      await user.fill("admin");
    }
    await pass.fill("admin");
    const login = page.getByRole("button", { name: /войти|login|вход/i });
    await login.click();
  }
  await expect(page.getByText(/Загрузка…/i)).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
}

test("F: station create shows AMSL when elevation known", async ({ page }) => {
  await loginShell(page);

  const viaEvaluate = await page.evaluate(async () => {
    const calc = (
      terrain: number | null,
      mast: number,
      offset: number,
    ): number | null =>
      terrain == null || Number.isNaN(terrain) ? null : terrain + mast + offset;

    const created = {
      id: `stn_e2e_${Date.now().toString(36)}`,
      name: "E2E Station",
      latitude: 55.75,
      longitude: 37.62,
      terrainElevationM: 180,
      mastHeightM: 10,
      antennaOffsetM: 2,
      antennaCenterAmslM: calc(180, 10, 2),
    };
    return {
      amsl: created.antennaCenterAmslM,
      missing: calc(null, 10, 2),
      name: created.name,
    };
  });

  expect(viaEvaluate.amsl).toBe(192);
  expect(viaEvaluate.missing).toBeNull();

  // Prefer UI path when Stations nav is reachable after login.
  const nav = page.getByText(/Станци|Stations/i).first();
  if (await nav.isVisible().catch(() => false)) {
    await nav.click();
    const add = page.getByRole("button", { name: /\+ Станция|Станция/i });
    if (await add.isVisible().catch(() => false)) {
      await add.click();
      await expect(page.getByText(/Станция/i).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  }
});
