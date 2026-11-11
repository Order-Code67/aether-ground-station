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

  await expect(page.getByTestId("station-planner")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("Дерево объектов")).toBeVisible();
  // Station card is glass-overlay; expand if collapsed (map-first default).
  const card = page.getByLabel("Карточка станции");
  if (!(await card.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /Карточка/i }).click();
  }
  await expect(card).toBeVisible();
  await expect(page.getByLabel("Инженерная панель")).toBeVisible();
  await expect(page.getByLabel("Поворотный механизм")).toBeVisible();
  await expect(page.getByText(/3D · симуляция/i).first()).toBeVisible();
});
