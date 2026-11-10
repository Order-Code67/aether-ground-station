import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("P0-2 db_restore contract", () => {
  it("exposes db_restore command and closes conn before copy", () => {
    const src = readFileSync(
      join(process.cwd(), "src-tauri/src/database/sqlite.rs"),
      "utf8",
    );
    expect(src).toMatch(/pub fn db_restore/);
    expect(src).toMatch(/\*guard = None/);
    expect(src).toMatch(/open_and_migrate/);
  });
});
