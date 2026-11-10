import { describe, expect, it } from "vitest";
import { calcAntennaCenterAmsl } from "./index";

describe("calcAntennaCenterAmsl", () => {
  it("sums elevation + mast + offset", () => {
    expect(calcAntennaCenterAmsl(180, 10, 2)).toBe(192);
  });

  it("returns null when terrain missing", () => {
    expect(calcAntennaCenterAmsl(null, 10, 2)).toBeNull();
    expect(calcAntennaCenterAmsl(undefined, 10, 2)).toBeNull();
  });
});
