import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural acceptance for P0-1: free role bind must be disabled;
 * login path must use auth_login.
 */
describe("P0-1 auth login contract", () => {
  const authRs = readFileSync(
    join(process.cwd(), "src-tauri/src/auth_session.rs"),
    "utf8",
  );
  const store = readFileSync(
    join(process.cwd(), "src/stores/authStore.ts"),
    "utf8",
  );

  it("rejects auth_bind_session free role bind", () => {
    expect(authRs).toMatch(/auth_bind_session отключён/);
    expect(authRs).toMatch(/pub fn auth_login/);
  });

  it("frontend login invokes auth_login in Tauri", () => {
    expect(store).toMatch(/auth_login/);
    expect(store).not.toMatch(/auth_bind_session/);
  });
});
