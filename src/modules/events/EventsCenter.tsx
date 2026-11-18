import { useMemo, useState } from "react";
import { useEventLogStore } from "@/stores/eventLogStore";
import { dbListEvents } from "@/services/database";
import { isTauriRuntime } from "@/services/tauri";
import { useEffect } from "react";
import type { AppEvent, EventSeverity } from "@/types";

/**
 * GS-9 Event Center — filter / search / export; retention handled backend prune.
 */
export function EventsCenter() {
  const live = useEventLogStore((s) => s.events);
  const [dbEvents, setDbEvents] = useState<AppEvent[]>([]);
  const [severity, setSeverity] = useState<string>("all");
  const [query, setQuery] = useState("");

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
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aether-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-sm">
      <div>
        <h1 className="text-lg font-semibold">Центр событий</h1>
        <p className="text-xs text-ags-muted">
          Журнал подключений, ошибок видео/FFmpeg/SQLite/Gateway. Ротация на
          backend (max rows).
        </p>
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
    </div>
  );
}
