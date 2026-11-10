import { describe, expect, it } from "vitest";
import { MODULES } from "./app";

describe("V2.1 modules", () => {
  it("includes robotics aerial hid", () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids).toContain("robotics");
    expect(ids).toContain("aerial");
    expect(ids).toContain("hid");
  });
});
