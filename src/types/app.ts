/** Идентификаторы модулей платформы (V2). */
export type ModuleId =
  | "workspace"
  | "video"
  | "walksnail"
  | "map"
  | "stations"
  | "terrain"
  | "pantilt"
  | "devices"
  | "network"
  | "usb"
  | "serial"
  | "telemetry"
  | "archive"
  | "inventory"
  | "reports"
  | "plugins"
  | "profiles"
  | "remote"
  | "settings";

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  stage: number;
  description: string;
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    id: "workspace",
    label: "Рабочее пространство",
    stage: 2,
    description: "Конструктор панелей",
  },
  {
    id: "map",
    label: "Карта",
    stage: 4,
    description: "MapLibre, офлайн и слои",
  },
  {
    id: "stations",
    label: "Станции",
    stage: 5,
    description: "Station Planner",
  },
  {
    id: "terrain",
    label: "Рельеф",
    stage: 6,
    description: "Terrain Engine / DEM",
  },
  {
    id: "video",
    label: "Видео",
    stage: 3,
    description: "Video Engine",
  },
  {
    id: "walksnail",
    label: "Walksnail",
    stage: 3,
    description: "Адаптер Walksnail",
  },
  {
    id: "pantilt",
    label: "Pan-Tilt",
    stage: 8,
    description: "Мониторинг поворотного механизма",
  },
  {
    id: "devices",
    label: "Устройства",
    stage: 1,
    description: "Device Manager",
  },
  {
    id: "network",
    label: "Сеть",
    stage: 1,
    description: "Network Manager",
  },
  {
    id: "usb",
    label: "USB",
    stage: 1,
    description: "USB enumeration",
  },
  {
    id: "serial",
    label: "COM / UART",
    stage: 1,
    description: "COM-порты",
  },
  {
    id: "telemetry",
    label: "Телеметрия",
    stage: 7,
    description: "Telemetry Engine",
  },
  {
    id: "archive",
    label: "Архив",
    stage: 8,
    description: "Записи и журналы",
  },
  {
    id: "inventory",
    label: "Инвентарь",
    stage: 8,
    description: "Equipment / Maintenance",
  },
  {
    id: "reports",
    label: "Отчёты",
    stage: 8,
    description: "Reports Manager",
  },
  {
    id: "plugins",
    label: "Плагины",
    stage: 10,
    description: "Plugin Manager",
  },
  {
    id: "profiles",
    label: "Профили",
    stage: 8,
    description: "Комплексы и профили",
  },
  {
    id: "remote",
    label: "Удалённо",
    stage: 9,
    description: "Remote Infrastructure",
  },
  {
    id: "settings",
    label: "Настройки",
    stage: 1,
    description: "Конфигурация",
  },
] as const;

export interface AppInfo {
  name: string;
  version: string;
  stage: string;
  platform: string;
}
