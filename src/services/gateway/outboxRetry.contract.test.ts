import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("P1-4 outbox failed/retry", () => {
  it("marks failed on HTTP error and exposes retry command", () => {
    const gw = readFileSync(
      resolve(root, "src-tauri/src/gateway/mod.rs"),
      "utf8",
    );
    expect(gw).toContain("mark_outbox_failed");
    expect(gw).toContain("status='failed'");
    expect(gw).toContain("gateway_retry_failed");
    expect(gw).toContain("failed_outbox");

    const mig = readFileSync(
      resolve(root, "src-tauri/src/database/migrations.rs"),
      "utf8",
    );
    expect(mig).toContain("migrate_v4");
    expect(mig).toContain("attempts");
  });
});
