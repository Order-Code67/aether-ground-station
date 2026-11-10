import { defineConfig } from "@playwright/test";

/**
 * Tauri / WebView2 e2e harness.
 * Set AGS_TAURI_URL to the WebView2 debugger URL or use tauri-driver.
 * Without env, tests are skipped (CI-safe).
 */
const baseURL = process.env.AGS_TAURI_URL;

export default defineConfig({
  testDir: "e2e/tauri",
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: baseURL || "http://127.0.0.1:1424",
    trace: "on-first-retry",
  },
  // No webServer — attach to running `tauri dev` / packaged app.
});
