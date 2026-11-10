import { describe, expect, it } from "vitest";
import { validateProfileBundle } from "./importValidate";

describe("validateProfileBundle", () => {
  it("rejects garbage", () => {
    expect(validateProfileBundle(null)).toBeNull();
    expect(validateProfileBundle({ format: "x" })).toBeNull();
  });

  it("accepts valid bundle", () => {
    const ok = validateProfileBundle({
      format: "aether-gs-profile",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: {
        id: "p1",
        name: "Test",
        createdAt: "",
        updatedAt: "",
        deviceIds: [],
        connectionParams: {},
      },
    });
    expect(ok).not.toBeNull();
  });
});
