import { test, expect } from "@playwright/test";

async function loginShell(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText(/Aether|Вход|admin|Загрузка/i).first()).toBeVisible({
    timeout: 30_000,
  });
  const pass = page.locator('input[type="password"]').first();
  if (await pass.isVisible().catch(() => false)) {
    await pass.fill("admin");
    await page.getByRole("button", { name: /войти|login|вход/i }).click();
  }
}

test("GS-2: complexes section reachable", async ({ page }) => {
  await loginShell(page);
  const nav = page.getByRole("navigation", { name: /основная навигация/i });
  await nav.getByLabel("Комплексы", { exact: true }).click();
  await expect(
    page.getByText(/Комплексы и площадки|Complex Manager|создайте или выберите/i).first(),
  ).toBeVisible({ timeout: 10_000 });
});
