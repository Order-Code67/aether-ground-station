import { MODULES } from "@/types";
import { tabsForSection } from "@/types/navigation";
import { useNavigationStore } from "@/stores/navigationStore";
import { cn } from "@/utils/cn";

export function SectionSubNav() {
  const activeSection = useNavigationStore((s) => s.activeSection);
  const activeModule = useNavigationStore((s) => s.activeModule);
  const showAdvanced = useNavigationStore((s) => s.showAdvanced);
  const setModuleInSection = useNavigationStore((s) => s.setModuleInSection);

  if (activeSection === "home") return null;

  const tabs = tabsForSection(activeSection, {
    includeAdvanced: showAdvanced && activeSection === "settings",
  });
  if (tabs.length <= 1) return null;

  return (
    <div
      className="flex shrink-0 flex-wrap gap-1 border-b border-ags-border-subtle bg-ags-surface px-3 py-2"
      role="tablist"
      aria-label="Подразделы"
    >
      {tabs.map((id) => {
        const label = MODULES.find((m) => m.id === id)?.label ?? id;
        const active = activeModule === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setModuleInSection(id)}
            className={cn(
              "rounded px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-ags-elevated text-ags-accent"
                : "text-ags-muted hover:bg-ags-elevated/50 hover:text-ags-fg",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
