import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useAuthStore } from "@/stores/authStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { PANEL_KIND_LABELS } from "@/types";
import { templateLabel, WORKSPACE_TEMPLATES } from "./templates";

export function WorkspaceView() {
  const layouts = useWorkspaceStore((s) => s.layouts);
  const activeLayoutId = useWorkspaceStore((s) => s.activeLayoutId);
  const layout = useWorkspaceStore((s) => s.active());
  const setActiveLayout = useWorkspaceStore((s) => s.setActiveLayout);
  const togglePanel = useWorkspaceStore((s) => s.togglePanel);
  const duplicateActive = useWorkspaceStore((s) => s.duplicateActive);
  const applyTemplate = useWorkspaceStore((s) => s.applyTemplate);
  const applyRolePack = useWorkspaceStore((s) => s.applyRolePack);
  const role = useAuthStore((s) => s.session?.user.role) ?? "Operator";
  const complexId = useSelectionStore((s) => s.complexId);
  const siteId = useSelectionStore((s) => s.siteId);
  const stationId = useSelectionStore((s) => s.stationId);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="workspace-view">
      <div className="flex flex-wrap items-center gap-1 border-b border-ags-border-subtle px-2 py-1.5">
        {layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveLayout(l.id)}
            className={
              l.id === activeLayoutId
                ? "rounded-t border border-b-0 border-ags-accent/50 bg-ags-elevated px-3 py-1 text-xs text-ags-accent"
                : "rounded-t border border-transparent px-3 py-1 text-xs text-ags-dim hover:text-ags-fg"
            }
          >
            {l.name}
          </button>
        ))}
        <button
          type="button"
          className="ml-1 rounded border border-ags-border px-2 py-0.5 text-xs text-ags-muted"
          onClick={() => applyTemplate("custom")}
          title="Новая вкладка"
        >
          +
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-0.5 text-xs text-ags-muted"
          onClick={() => duplicateActive()}
        >
          Дублировать
        </button>
        <button
          type="button"
          className="rounded border border-ags-accent/40 px-2 py-0.5 text-xs text-ags-accent"
          onClick={() => applyRolePack(role)}
          title={`Пакет роли ${role}`}
        >
          Пакет: {role}
        </button>
        {WORKSPACE_TEMPLATES.map((t) => (
          <button
            key={t}
            type="button"
            className="rounded border border-ags-border px-2 py-0.5 text-[10px] text-ags-dim"
            onClick={() => applyTemplate(t)}
          >
            {templateLabel(t)}
          </button>
        ))}
      </div>
      <div className="border-b border-ags-border-subtle px-4 py-1 font-mono text-[10px] text-ags-dim">
        Sync: complex={complexId ?? "—"} · site={siteId ?? "—"} · station=
        {stationId ?? "—"}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ags-border-subtle px-4 py-2 text-xs text-ags-muted">
        <span className="font-semibold text-ags-fg">{layout.name}</span>
        <span>·</span>
        <span>Шаблон: {templateLabel(layout.template)}</span>
        <span className="mx-2 h-4 w-px bg-ags-border" />
        {Object.values(layout.panels).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => togglePanel(p.id)}
            title={p.visible ? "unpin" : "pin"}
            className={
              p.visible
                ? "rounded border border-ags-accent/40 bg-ags-elevated px-2 py-0.5 text-ags-accent"
                : "rounded border border-ags-border px-2 py-0.5 text-ags-dim"
            }
          >
            {PANEL_KIND_LABELS[p.kind]}
            <span className="ml-1 opacity-60">
              {p.visible ? "pin" : "off"}
            </span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <WorkspaceCanvas />
      </div>
    </div>
  );
}

export { WorkspaceCanvas } from "./WorkspaceCanvas";
export { createTemplateLayout, WORKSPACE_TEMPLATES, templateLabel } from "./templates";
