import { test, expect } from "@playwright/test";

async function enterShell(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText(/Aether|Вход|admin|Загрузка/i).first()).toBeVisible({
    timeout: 30_000,
  });
  const pass = page.locator('input[type="password"]').first();
  if (await pass.isVisible().catch(() => false)) {
    const user = page.locator('input[type="text"], input[name="username"]').first();
    if (await user.isVisible().catch(() => false)) await user.fill("admin");
    await pass.fill("admin");
    await page.getByRole("button", { name: /войти|login|вход/i }).click();
  }
  await expect(page.getByText(/Загрузка…/i))
    .toBeHidden({ timeout: 15_000 })
    .catch(() => undefined);
}

test("aiming: planner shows controls and corridor toggles", async ({ page }) => {
  await enterShell(page);

  const nav = page.getByRole("navigation", { name: /основная навигация/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.getByLabel("Карта и планирование", { exact: true }).click();

  await expect(page.getByTestId("station-planner")).toBeVisible({
    timeout: 15_000,
  });

  const aiming = page.getByLabel("Наведение станции");
  if (!(await aiming.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Наведение/i }).click();
  }
  await expect(aiming).toBeVisible();
  await expect(page.getByTestId("aiming-controls")).toBeVisible();

  await expect(
    page.getByRole("button", { name: /Точка станции|Клик: точка/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Направление полёта|Клик: направление/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Коридор высот/i })).toBeVisible();
  await expect(page.getByText(/Пресеты наведения/i)).toBeVisible();
  await expect(page.getByText(/COM углы \(только чтение\)/i)).toBeVisible();
});
