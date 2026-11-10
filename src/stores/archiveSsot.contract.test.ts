import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

describe("P1-3 archive SSOT", () => {
  it("archiveStore has no zustand persist localStorage", () => {
    const store = readFileSync(
      resolve(root, "src/stores/archiveStore.ts"),
      "utf8",
    );
    expect(store).not.toMatch(/from ["']zustand\/middleware["']/);
    expect(store).toContain("hydrate");
    expect(store).toContain("SQLite");
  });

  it("useSqliteSync mirrors archive_state", () => {
    const sync = readFileSync(
      resolve(root, "src/hooks/useSqliteSync.ts"),
      "utf8",
    );
    expect(sync).toContain("archive_state");
    expect(sync).toContain("useArchiveStore");
  });
});
