import { useEffect } from "react";
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

  const complex = complexes.find((c) => c.id === activeComplexId);
  const site = sites.find((s) => s.id === activeSiteId);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-ags-border-subtle bg-ags-surface px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded bg-ags-elevated">
          <img
            src="/aether-logo.jpg"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ags-dim">
            Aether Ground Station
          </div>
          <div className="truncate text-sm font-semibold text-ags-fg">
            {complex?.name ?? "Комплекс не выбран"}
            {site ? ` · ${site.name}` : ""}
          </div>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-ags-border" />

      <label className="flex items-center gap-1.5 text-xs text-ags-muted">
        Комплекс
        <select
          className="max-w-[10rem] rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
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

      <label className="flex items-center gap-1.5 text-xs text-ags-muted">
        Площадка
        <select
          className="max-w-[10rem] rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
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

      <StatusBadge label={ready ? "Готово" : "Загрузка"} tone={ready ? "ok" : "warn"} />
      <StatusBadge
        label={isTauriRuntime() ? "Desktop" : "Preview"}
        tone={isTauriRuntime() ? "ok" : "neutral"}
      />

      <label className="flex items-center gap-1.5 text-xs text-ags-muted">
        Workspace
        <select
          className="max-w-[9rem] rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
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

      <label className="flex items-center gap-1.5 text-xs text-ags-muted">
        Шаблон
        <select
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
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
        {warnCount > 0 ? (
          <StatusBadge label={`Пред. ${warnCount}`} tone="warn" />
        ) : (
          <span
            className="text-[10px] text-ags-dim"
            title="Нет предупреждений в сессии"
          >
            Уведомления: нет
          </span>
        )}
        {session && (
          <StatusBadge
            label={`${session.user.username} · ${session.user.role}`}
            tone="ok"
          />
        )}
        <button
          type="button"
          onClick={() => setDeviceRailVisible(!active.deviceRailVisible)}
          className="rounded border border-ags-border px-2 py-1 text-xs text-ags-muted hover:bg-ags-elevated hover:text-ags-fg"
        >
          {active.deviceRailVisible ? "Скрыть rail" : "Rail"}
        </button>
        <button
          type="button"
          onClick={() => setEventLogVisible(!active.eventLogVisible)}
          className="rounded border border-ags-border px-2 py-1 text-xs text-ags-muted hover:bg-ags-elevated hover:text-ags-fg"
        >
          {active.eventLogVisible ? "Скрыть журнал" : "Журнал"}
        </button>
      </div>
    </header>
  );
}
