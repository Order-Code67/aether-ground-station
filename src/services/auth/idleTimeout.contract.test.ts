import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("1.0.1 SEC-1 idle session timeout", () => {
  it("auth_session exposes timeout and auth_touch", () => {
    const auth = readFileSync(
      resolve(root, "src-tauri/src/auth_session.rs"),
      "utf8",
    );
    expect(auth).toContain("DEFAULT_IDLE_TIMEOUT_SECS");
    expect(auth).toContain("auth_touch");
    expect(auth).toContain("ensure_fresh");
    expect(auth).toContain("Сессия истекла");
  });

  it("frontend wires idle guard", () => {
    const guard = readFileSync(
      resolve(root, "src/hooks/useAuthIdleGuard.ts"),
      "utf8",
    );
    expect(guard).toContain("touchSession");
    const app = readFileSync(resolve(root, "src/app/App.tsx"), "utf8");
    expect(app).toContain("useAuthIdleGuard");
  });
});
