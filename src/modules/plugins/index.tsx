import { useEffect, useState } from "react";
import {
  pluginManager,
  type PluginManifest,
} from "@/services/plugins/pluginManager";
import { useAuthStore } from "@/stores/authStore";

export function PluginsView() {
  const can = useAuthStore((s) => s.can("managePlugins"));
  const [list, setList] = useState<PluginManifest[]>([]);

  useEffect(() => {
    void pluginManager.list().then(setList);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6 text-sm">
      <div>
        <h1 className="text-xl font-semibold">Plugin Manager</h1>
        <p className="text-xs text-ags-muted">
          Реестр расширений. Ошибки плагинов изолируются; permissions `*` /
          system.exec запрещены.
        </p>
      </div>
      <ul className="space-y-2">
        {list.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded border border-ags-border bg-ags-panel px-3 py-2"
          >
            <div>
              <div className="font-medium">
                {p.name}{" "}
                <span className="text-xs text-ags-dim">v{p.version}</span>
              </div>
              <div className="text-xs text-ags-dim">{p.description}</div>
              <div className="font-mono text-[10px] text-ags-muted">
                {p.permissions.join(", ") || "no permissions"}
              </div>
            </div>
            <button
              type="button"
              disabled={!can}
              className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
              onClick={() =>
                void (async () => {
                  await pluginManager.setEnabled(p.id, !p.enabled);
                  setList(await pluginManager.list());
                })()
              }
            >
              {p.enabled ? "Выключить" : "Включить"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
