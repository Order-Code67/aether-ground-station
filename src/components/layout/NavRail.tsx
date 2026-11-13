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
import { NAV_SECTIONS, type NavSectionId } from "@/types";
import { useNavigationStore } from "@/stores/navigationStore";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore } from "@/stores/appStore";
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
  const version = useAppStore((s) => s.appInfo?.version) ?? "1.0.0";
  const session = useAuthStore((s) => s.session);

  return (
    <nav
      className="ags-rail flex w-[4.75rem] shrink-0 flex-col items-center gap-0.5 border-r border-ags-border-subtle bg-ags-surface/95 py-3 backdrop-blur-sm"
      aria-label="Основная навигация"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5">
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
                "group relative flex w-[4rem] flex-col items-center gap-0.5 rounded-lg px-1 py-2 transition-all disabled:opacity-30",
                active
                  ? "bg-ags-accent/15 text-ags-accent shadow-[inset_0_0_0_1px_rgba(61,139,253,0.35)]"
                  : "text-ags-muted hover:bg-ags-elevated/70 hover:text-ags-fg",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-ags-accent" />
              )}
              <Icon size={18} strokeWidth={active ? 2 : 1.6} />
              <span className="max-w-full truncate text-center text-[9px] leading-tight tracking-wide">
                {sec.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 w-full border-t border-ags-border-subtle px-1.5 pt-2 text-center">
        {session && (
          <p className="truncate text-[9px] text-ags-dim" title={session.user.username}>
            {session.user.username}
          </p>
        )}
        <p className="text-[9px] font-medium tracking-wider text-ags-dim">
          v{version}
        </p>
      </div>
    </nav>
  );
}
