import { describe, expect, it } from "vitest";
import { MODULES } from "./app";
import { NAV_SECTIONS } from "./navigation";

describe("V2.1 modules", () => {
  it("includes robotics aerial hid and home", () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids).toContain("home");
    expect(ids).toContain("robotics");
    expect(ids).toContain("aerial");
    expect(ids).toContain("hid");
  });

  it("primary nav has eight sections", () => {
    expect(NAV_SECTIONS).toHaveLength(8);
  });
});
