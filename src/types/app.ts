/** Идентификаторы модулей платформы (V2 + GS-1 home). */
export type ModuleId =
  | "home"
  | "complexes"
  | "catalogs"
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
  | "events"
  | "inventory"
  | "reports"
  | "plugins"
  | "profiles"
  | "remote"
  | "robotics"
  | "aerial"
  | "hid"
  | "settings";

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  stage: number;
  description: string;
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    id: "home",
    label: "Главная",
    stage: 1,
    description: "Dashboard сводки комплекса",
  },
  {
    id: "complexes",
    label: "Комплексы",
    stage: 2,
    description: "Complex & Site Manager",
  },
  {
    id: "catalogs",
    label: "Мачты и антенны",
    stage: 4,
    description: "Mast & Antenna catalogs",
  },
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
    description: "Terrain Map · рельеф · радиус · радиовидимость",
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
    id: "events",
    label: "Журнал событий",
    stage: 9,
    description: "Event Center",
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
    id: "robotics",
    label: "Robotics",
    stage: 11,
    description: "Мониторинг робототехники",
  },
  {
    id: "aerial",
    label: "Aerial",
    stage: 11,
    description: "Наблюдение БВС (без пилота)",
  },
  {
    id: "hid",
    label: "HID",
    stage: 11,
    description: "Локальные контроллеры",
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
