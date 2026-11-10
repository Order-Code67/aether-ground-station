import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("P0-4 gateway sync secret", () => {
  it("client requires syncSecret and sends token header", () => {
    const gw = readFileSync(
      join(process.cwd(), "src-tauri/src/gateway/mod.rs"),
      "utf8",
    );
    expect(gw).toMatch(/sync_secret/);
    expect(gw).toMatch(/X-Ags-Sync-Token/);
    expect(gw).toMatch(/Задайте syncSecret/);
  });

  it("server rejects missing token with 401", () => {
    const srv = readFileSync(
      join(process.cwd(), "services/gateway-server/server.mjs"),
      "utf8",
    );
    expect(srv).toMatch(/GATEWAY_SYNC_SECRET/);
    expect(srv).toMatch(/401/);
    expect(srv).toMatch(/x-ags-sync-token/i);
  });
});
