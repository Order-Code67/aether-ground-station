import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("P1-5 permission matrix", () => {
  it("write station/inventory/gateway commands call require_role_write", () => {
    const stations = read("src-tauri/src/database/stations.rs");
    expect(stations).toContain("require_role_write");
    expect(stations).toContain("station_upsert");
    expect(stations).toContain("station_delete");

    const inventory = read("src-tauri/src/database/inventory.rs");
    expect(inventory).toContain("require_role_write");

    const gateway = read("src-tauri/src/gateway/mod.rs");
    expect(gateway).toContain("gateway_retry_failed");
    expect(gateway).toMatch(/gateway_try_sync[\s\S]*require_role_write/);
  });

  it("docs matrix lists Observer deny rule", () => {
    const doc = read("docs/AETHER_PERMISSION_MATRIX.md");
    expect(doc).toContain("Observer");
    expect(doc).toContain("require_role_write");
  });
});
