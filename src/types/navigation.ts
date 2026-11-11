import type { ModuleId } from "./app";

/** Primary IA — exactly eight top-level sections (GS-1). */
export type NavSectionId =
  | "home"
  | "complexes"
  | "planning"
  | "video"
  | "telemetry"
  | "equipment"
  | "events"
  | "settings";

export interface NavSectionDef {
  id: NavSectionId;
  label: string;
  /** Primary tabs shown under the section. */
  tabs: ModuleId[];
  /** Hidden from primary rail; reachable from Settings Advanced or deep link. */
  advancedTabs?: ModuleId[];
}

export const NAV_SECTIONS: readonly NavSectionDef[] = [
  { id: "home", label: "Главная", tabs: ["home"] },
  {
    id: "complexes",
    label: "Комплексы",
    tabs: ["complexes", "stations", "inventory", "profiles"],
  },
  {
    id: "planning",
    label: "Карта и планирование",
    tabs: ["map", "stations", "catalogs", "terrain", "pantilt"],
  },
  {
    id: "video",
    label: "Видео",
    tabs: ["video", "walksnail", "archive"],
  },
  {
    id: "telemetry",
    label: "Телеметрия",
    tabs: ["telemetry"],
    advancedTabs: ["aerial"],
  },
  {
    id: "equipment",
    label: "Оборудование",
    tabs: ["devices", "serial", "usb", "network", "hid"],
  },
  {
    id: "events",
    label: "События",
    tabs: ["events", "archive", "reports"],
  },
  {
    id: "settings",
    label: "Настройки",
    tabs: ["settings", "workspace"],
    advancedTabs: ["remote", "plugins", "robotics", "aerial"],
  },
] as const;

const MODULE_TO_SECTION: Partial<Record<ModuleId, NavSectionId>> = {
  home: "home",
  complexes: "complexes",
  profiles: "complexes",
  stations: "complexes",
  inventory: "complexes",
  map: "planning",
  catalogs: "planning",
  terrain: "planning",
  pantilt: "planning",
  video: "video",
  walksnail: "video",
  archive: "video",
  events: "events",
  telemetry: "telemetry",
  aerial: "telemetry",
  devices: "equipment",
  serial: "equipment",
  usb: "equipment",
  network: "equipment",
  hid: "equipment",
  reports: "events",
  settings: "settings",
  workspace: "settings",
  remote: "settings",
  plugins: "settings",
  robotics: "settings",
};

/** Prefer planning when module appears in multiple sections (stations). */
const MODULE_SECTION_OVERRIDE: Partial<Record<ModuleId, NavSectionId>> = {
  stations: "planning",
};

export function sectionForModule(moduleId: ModuleId): NavSectionId {
  return (
    MODULE_SECTION_OVERRIDE[moduleId] ??
    MODULE_TO_SECTION[moduleId] ??
    "home"
  );
}

export function defaultModuleForSection(sectionId: NavSectionId): ModuleId {
  const sec = NAV_SECTIONS.find((s) => s.id === sectionId);
  return sec?.tabs[0] ?? "home";
}

export function tabsForSection(
  sectionId: NavSectionId,
  opts?: { includeAdvanced?: boolean },
): ModuleId[] {
  const sec = NAV_SECTIONS.find((s) => s.id === sectionId);
  if (!sec) return ["home"];
  if (opts?.includeAdvanced && sec.advancedTabs?.length) {
    return [...sec.tabs, ...sec.advancedTabs];
  }
  return [...sec.tabs];
}
