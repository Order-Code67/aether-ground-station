import {
  Boxes,
  Gauge,
  Home,
  Map,
  Radio,
  Settings,
  Video,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  NAV_SECTIONS,
  type NavSectionId,
} from "@/types";
import { useNavigationStore } from "@/stores/navigationStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/utils/cn";

const SECTION_ICONS: Record<NavSectionId, LucideIcon> = {
  home: Home,
  complexes: Waypoints,
  planning: Map,
  video: Video,
  telemetry: Gauge,
  equipment: Radio,
  events: Boxes,
  settings: Settings,
};

export function NavRail() {
  const activeSection = useNavigationStore((s) => s.activeSection);
  const setSection = useNavigationStore((s) => s.setSection);
  const canEdit = useAuthStore((s) => s.can("editConfig"));

  return (
    <nav
      className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1 border-r border-ags-border-subtle bg-ags-surface py-3"
      aria-label="Основная навигация"
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
      {NAV_SECTIONS.map((sec) => {
        const Icon = SECTION_ICONS[sec.id];
        const active = activeSection === sec.id;
        const locked = sec.id === "settings" && !canEdit;
        return (
          <button
            key={sec.id}
            type="button"
            title={locked ? `${sec.label} (нет прав)` : sec.label}
            aria-label={sec.label}
            aria-current={active ? "page" : undefined}
            disabled={locked}
            onClick={() => setSection(sec.id)}
            className={cn(
              "flex w-[3.5rem] flex-col items-center gap-0.5 rounded-md px-1 py-1.5 transition-colors disabled:opacity-30",
              active
                ? "bg-ags-elevated text-ags-accent"
                : "text-ags-muted hover:bg-ags-elevated/60 hover:text-ags-fg",
            )}
          >
            <Icon size={18} strokeWidth={1.75} />
            <span className="max-w-full truncate text-center text-[9px] leading-tight">
              {sec.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
