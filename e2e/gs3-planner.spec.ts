import { test, expect } from "@playwright/test";

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
  await expect(page.getByText(/Загрузка…/i))
    .toBeHidden({ timeout: 15_000 })
    .catch(() => undefined);
}

test("GS-3: Station Planner 4-pane reachable from map section", async ({
  page,
}) => {
  await loginShell(page);

  const nav = page.getByRole("navigation", { name: /основная навигация/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.getByLabel("Карта и планирование", { exact: true }).click();

  await expect(page.getByTestId("terrain-map")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /^Карта$/i })).toBeVisible();
  await expect(page.getByText(/Параметры связи/i)).toBeVisible();
  await expect(page.getByText(/Поворотный механизм/i)).toBeVisible();
  await expect(page.getByText(/Профиль высот/i)).toBeVisible();
});
