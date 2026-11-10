import {
  Archive,
  Boxes,
  Cable,
  Cloud,
  Compass,
  FileText,
  Gauge,
  LayoutGrid,
  Map,
  Mountain,
  Puzzle,
  Radio,
  Settings,
  Snail,
  TowerControl,
  Usb,
  Video,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODULES, type ModuleId } from "@/types";
import { useNavigationStore } from "@/stores/navigationStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/utils/cn";

const ICONS: Record<ModuleId, LucideIcon> = {
  workspace: LayoutGrid,
  video: Video,
  walksnail: Snail,
  map: Map,
  stations: TowerControl,
  terrain: Mountain,
  pantilt: Compass,
  devices: Radio,
  network: Cable,
  usb: Usb,
  serial: Waypoints,
  telemetry: Gauge,
  archive: Archive,
  inventory: Boxes,
  reports: FileText,
  plugins: Puzzle,
  profiles: TowerControl,
  remote: Cloud,
  settings: Settings,
};

export function NavRail() {
  const activeModule = useNavigationStore((s) => s.activeModule);
  const setActiveModule = useNavigationStore((s) => s.setActiveModule);
  const canManage = useAuthStore((s) => s.can("manageDevices"));
  const canEdit = useAuthStore((s) => s.can("editConfig"));
  const canPlugins = useAuthStore((s) => s.can("managePlugins"));

  return (
    <nav
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-ags-border-subtle bg-ags-surface py-3"
      aria-label="Навигация модулей"
    >
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-ags-elevated"
        title="Aether Ground Station"
      >
        <img
          src="/aether-logo.jpg"
          alt="Aether Ground Station"
          className="h-full w-full object-cover"
        />
      </div>
      {MODULES.map((mod) => {
        const Icon = ICONS[mod.id];
        const active = activeModule === mod.id;
        const locked =
          (mod.id === "settings" && !canEdit) ||
          (mod.id === "plugins" && !canPlugins) ||
          (mod.id === "remote" && !canManage && !canEdit);
        return (
          <button
            key={mod.id}
            type="button"
            title={locked ? `${mod.label} (нет прав)` : mod.label}
            aria-label={mod.label}
            aria-current={active ? "page" : undefined}
            disabled={locked}
            onClick={() => setActiveModule(mod.id)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md transition-colors disabled:opacity-30",
              active
                ? "bg-ags-elevated text-ags-accent"
                : "text-ags-muted hover:bg-ags-elevated/60 hover:text-ags-fg",
            )}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}
    </nav>
  );
}
