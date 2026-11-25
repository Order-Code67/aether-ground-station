import { useMemo, useState, useEffect } from "react";
import { useEventLogStore } from "@/stores/eventLogStore";
import { dbListEvents } from "@/services/database";
import { isTauriRuntime } from "@/services/tauri";
import type { AppEvent, EventSeverity } from "@/types";
import {
  diagnosticsManager,
  type DiagnosticEntry,
} from "@/services/diagnostics/diagnosticsManager";

/**
 * GS-9 Event Center — filter / search / export; retention handled backend prune.
 */
export function EventsCenter() {
  const live = useEventLogStore((s) => s.events);
  const [dbEvents, setDbEvents] = useState<AppEvent[]>([]);
  const [severity, setSeverity] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"events" | "diagnostics">("events");
  const [diags, setDiags] = useState<DiagnosticEntry[]>([]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void dbListEvents(500)
      .then((rows) =>
        setDbEvents(
          rows.map((r) => ({
            id: r.id,
            at: r.at,
            severity: r.severity as EventSeverity,
            source: r.source,
            message: r.message,
          })),
        ),
      )
      .catch(() => setDbEvents([]));
  }, [live.length]);

  useEffect(() => {
    void diagnosticsManager.hydrate().then(() => setDiags(diagnosticsManager.list()));
    return diagnosticsManager.subscribe(() => setDiags(diagnosticsManager.list()));
  }, []);

  const merged = useMemo(() => {
    const map = new Map<string, AppEvent>();
    for (const e of [...dbEvents, ...live]) map.set(e.id, e);
    return [...map.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [dbEvents, live]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((e) => {
      if (severity !== "all" && e.severity !== severity) return false;
      if (!q) return true;
      return (
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
      );
    });
  }, [merged, severity, query]);

  const exportJson = () => {
    const body =
      tab === "diagnostics"
        ? diagnosticsManager.exportJson()
        : JSON.stringify(filtered, null, 2);
    const blob = new Blob([body], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      tab === "diagnostics"
        ? `aether-diagnostics-${Date.now()}.json`
        : `aether-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-sm">
      <div>
        <h1 className="text-lg font-semibold">Центр событий</h1>
        <p className="text-xs text-ags-muted">
          Журнал подключений, ошибок видео/FFmpeg/SQLite/Gateway. Диагностика —
          только реальные события, без фиктивных метрик.
        </p>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className={
            tab === "events"
              ? "rounded bg-ags-accent px-2 py-1 text-xs text-white"
              : "rounded border border-ags-border px-2 py-1 text-xs"
          }
          onClick={() => setTab("events")}
        >
          События
        </button>
        <button
          type="button"
          className={
            tab === "diagnostics"
              ? "rounded bg-ags-accent px-2 py-1 text-xs text-white"
              : "rounded border border-ags-border px-2 py-1 text-xs"
          }
          onClick={() => setTab("diagnostics")}
        >
          Диагностика
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-xs"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">Все уровни</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
        <input
          className="min-w-[12rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1 text-xs"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 text-xs"
          onClick={exportJson}
        >
          Экспорт JSON
        </button>
      </div>
      {tab === "events" ? (
        <ul className="min-h-0 flex-1 space-y-1 overflow-auto font-mono text-[11px]">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="rounded border border-ags-border bg-ags-panel px-2 py-1"
            >
              <span className="text-ags-dim">{e.at}</span> ·{" "}
              <span className="text-ags-warning">{e.severity}</span> · {e.source}:{" "}
              {e.message}
            </li>
          ))}
          {!filtered.length && (
            <li className="text-ags-muted">Нет событий по фильтру</li>
          )}
        </ul>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-auto font-mono text-[11px]">
          {diags.map((d) => (
            <li
              key={d.id}
              className="rounded border border-ags-border bg-ags-panel px-2 py-1"
            >
              <span className="text-ags-dim">{d.at}</span> · {d.severity} ·{" "}
              {d.module}: {d.description}
              {d.remediation ? ` · ${d.remediation}` : ""}
            </li>
          ))}
          {!diags.length && (
            <li className="text-ags-muted">
              Диагностика пуста — нет ошибок/предупреждений (не заполняется
              нулями).
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
