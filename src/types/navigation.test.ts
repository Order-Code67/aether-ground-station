import { describe, expect, it } from "vitest";
import {
  NAV_SECTIONS,
  defaultModuleForSection,
  sectionForModule,
  tabsForSection,
} from "./navigation";

describe("NAV_SECTIONS", () => {
  it("has exactly eight primary sections", () => {
    expect(NAV_SECTIONS).toHaveLength(8);
    expect(NAV_SECTIONS.map((s) => s.id)).toEqual([
      "home",
      "complexes",
      "planning",
      "video",
      "telemetry",
      "equipment",
      "events",
      "settings",
    ]);
  });

  it("maps modules to sections", () => {
    expect(sectionForModule("home")).toBe("home");
    expect(sectionForModule("map")).toBe("planning");
    expect(sectionForModule("remote")).toBe("settings");
    expect(defaultModuleForSection("equipment")).toBe("devices");
  });

  it("keeps advanced tabs out of default tabs", () => {
    const settings = tabsForSection("settings");
    expect(settings).toContain("settings");
    expect(settings).not.toContain("remote");
    expect(tabsForSection("settings", { includeAdvanced: true })).toContain(
      "remote",
    );
  });
});
