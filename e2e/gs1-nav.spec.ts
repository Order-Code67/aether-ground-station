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

test("GS-1: eight primary nav sections and home dashboard", async ({
  page,
}) => {
  await loginShell(page);

  const nav = page.getByRole("navigation", { name: /основная навигация/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });

  for (const label of [
    "Главная",
    "Комплексы",
    "Карта и планирование",
    "Видео",
    "Телеметрия",
    "Оборудование",
    "События",
    "Настройки",
  ]) {
    await expect(nav.getByLabel(label, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: /^Главная$/i })).toBeVisible({
    timeout: 10_000,
  });
});
