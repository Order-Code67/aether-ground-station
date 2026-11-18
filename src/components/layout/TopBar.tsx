import { useEffect } from "react";
import { Bell } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useEventLogStore } from "@/stores/eventLogStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { isTauriRuntime } from "@/services/tauri";
import { templateLabel, WORKSPACE_TEMPLATES } from "@/modules/workspace/templates";
import type { WorkspaceTemplateId } from "@/types";

export function TopBar() {
  const layouts = useWorkspaceStore((s) => s.layouts);
  const activeLayoutId = useWorkspaceStore((s) => s.activeLayoutId);
  const setActiveLayout = useWorkspaceStore((s) => s.setActiveLayout);
  const applyTemplate = useWorkspaceStore((s) => s.applyTemplate);
  const setEventLogVisible = useWorkspaceStore((s) => s.setEventLogVisible);
  const setDeviceRailVisible = useWorkspaceStore((s) => s.setDeviceRailVisible);
  const active = useWorkspaceStore((s) => s.active());
  const ready = useAppStore((s) => s.ready);
  const appInfo = useAppStore((s) => s.appInfo);
  const session = useAuthStore((s) => s.session);

  const complexes = useStationPlannerStore((s) => s.complexes);
  const sites = useStationPlannerStore((s) => s.sites);
  const activeComplexId = useStationPlannerStore((s) => s.activeComplexId);
  const activeSiteId = useStationPlannerStore((s) => s.activeSiteId);
  const setActiveComplexId = useStationPlannerStore((s) => s.setActiveComplexId);
  const setActiveSiteId = useStationPlannerStore((s) => s.setActiveSiteId);
  const refresh = useStationPlannerStore((s) => s.refresh);

  const warnCount = useEventLogStore(
    (s) =>
      s.events.filter((e) => e.severity === "error" || e.severity === "warning")
        .length,
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <header className="ags-topbar flex h-12 shrink-0 items-center gap-3 border-b border-ags-border-subtle bg-ags-surface/95 px-4 backdrop-blur-md">
      {/* Single brand mark — NavRail has no logo */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="ags-brand-mark flex h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-ags-accent/30">
          <img
            src="/aether-logo.jpg"
            alt="Aether"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-tight text-ags-fg">
            Aether Ground Station
          </div>
          <div className="text-[10px] text-ags-dim">
            v{appInfo?.version ?? "1.0.0"}
            {ready ? " · система в норме" : " · загрузка…"}
          </div>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-ags-border sm:block" />

      <label className="ags-field hidden items-center gap-1.5 text-[11px] text-ags-muted md:flex">
        Комплекс
        <select
          className="ags-select max-w-[11rem]"
          value={activeComplexId ?? ""}
          onChange={(e) => setActiveComplexId(e.target.value || null)}
          aria-label="Активный комплекс"
        >
          <option value="">— нет —</option>
          {complexes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ags-field hidden items-center gap-1.5 text-[11px] text-ags-muted lg:flex">
        Площадка
        <select
          className="ags-select max-w-[10rem]"
          value={activeSiteId ?? ""}
          disabled={!activeComplexId}
          onChange={(e) => setActiveSiteId(e.target.value || null)}
          aria-label="Активная площадка"
        >
          <option value="">— нет —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ags-field hidden items-center gap-1.5 text-[11px] text-ags-muted xl:flex">
        Профиль
        <select
          className="ags-select max-w-[9rem]"
          value={activeLayoutId}
          onChange={(e) => setActiveLayout(e.target.value)}
          aria-label="Рабочее пространство"
        >
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ags-field hidden items-center gap-1.5 text-[11px] text-ags-muted 2xl:flex">
        Шаблон
        <select
          className="ags-select"
          defaultValue=""
          aria-label="Шаблон workspace"
          onChange={(e) => {
            const v = e.target.value as WorkspaceTemplateId;
            if (v) applyTemplate(v);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Создать…
          </option>
          {WORKSPACE_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {templateLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <StatusBadge
          label={ready ? "На связи" : "Загрузка"}
          tone={ready ? "ok" : "warn"}
        />
        {!isTauriRuntime() && (
          <StatusBadge label="Preview" tone="neutral" />
        )}

        <button
          type="button"
          className="relative rounded-lg border border-ags-border/80 bg-ags-elevated/50 p-1.5 text-ags-muted transition hover:border-ags-accent/40 hover:text-ags-fg"
          title={warnCount ? `Предупреждений: ${warnCount}` : "Уведомления"}
          onClick={() => setEventLogVisible(!active.eventLogVisible)}
          aria-label="Уведомления"
        >
          <Bell size={15} strokeWidth={1.75} />
          {warnCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ags-danger px-1 text-[9px] font-semibold text-white">
              {warnCount > 9 ? "9+" : warnCount}
            </span>
          )}
        </button>

        {session && (
          <div className="hidden items-center gap-2 rounded-lg border border-ags-border/70 bg-ags-elevated/40 px-2.5 py-1 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ags-success" />
            <span className="text-[11px] text-ags-fg">
              {session.user.username}
            </span>
            <span className="text-[10px] text-ags-dim">{session.user.role}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDeviceRailVisible(!active.deviceRailVisible)}
          className="hidden rounded-lg border border-ags-border/80 px-2 py-1 text-[11px] text-ags-muted transition hover:bg-ags-elevated hover:text-ags-fg xl:inline"
        >
          {active.deviceRailVisible ? "Скрыть rail" : "Rail"}
        </button>
      </div>
    </header>
  );
}
