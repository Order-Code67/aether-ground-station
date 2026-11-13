import { describe, expect, it } from "vitest";
import { geometricHorizonM } from "./radioHorizon";

describe("geometricHorizonM", () => {
  it("grows with antenna height", () => {
    const a = geometricHorizonM(10);
    const b = geometricHorizonM(40);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(5_000);
  });
});
