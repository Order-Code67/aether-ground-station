import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("1.0.1 SEC-2 gateway syncSecret at rest", () => {
  it("seals secret with enc: prefix on save", () => {
    const gw = readFileSync(
      resolve(root, "src-tauri/src/gateway/mod.rs"),
      "utf8",
    );
    expect(gw).toContain("fn seal_secret");
    expect(gw).toContain("fn open_secret");
    expect(gw).toContain("enc:");
    expect(gw).toMatch(/save_config[\s\S]*seal_secret/);
    expect(gw).toMatch(/load_config[\s\S]*open_secret/);
  });
});
