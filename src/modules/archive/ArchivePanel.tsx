import { useEffect, useMemo, useState } from "react";
import { useArchiveStore } from "@/stores/archiveStore";
import { eventBus } from "@/services/events/eventBus";
import { dbListRecordings } from "@/services/database";

export function ArchivePanel() {
  const clips = useArchiveStore((s) => s.clips);
  const removeClip = useArchiveStore((s) => s.removeClip);
  const storageFolder = useArchiveStore((s) => s.storageFolder);
  const setStorageFolder = useArchiveStore((s) => s.setStorageFolder);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const addClip = useArchiveStore((s) => s.addClip);

  useEffect(() => {
    void dbListRecordings()
      .then((rows) => {
        const have = new Set(useArchiveStore.getState().clips.map((c) => c.id));
        for (const r of rows) {
          if (have.has(r.id)) continue;
          let sizeBytes = 0;
          let mimeType: string | undefined;
          try {
            const meta = r.metadata ? JSON.parse(r.metadata) : {};
            sizeBytes =
              typeof meta.sizeBytes === "number" ? meta.sizeBytes : 0;
            mimeType = typeof meta.mimeType === "string" ? meta.mimeType : undefined;
          } catch {
            sizeBytes = 0;
          }
          addClip({
            id: r.id,
            title: r.filename.split(/[/\\]/).pop() ?? r.filename,
            startedAt: r.startTime,
            endedAt: r.endTime,
            source: r.sourceId ?? "recording",
            sizeBytes,
            mimeType,
            filePath: r.filename,
          });
        }
      })
      .catch(() => {
        /* preview / no DB */
      });
  }, [addClip]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.source.toLowerCase().includes(q),
    );
  }, [clips, query]);

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input
          className="min-w-[14rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
          placeholder="Папка хранения (путь)"
          value={storageFolder}
          onChange={(e) => {
            setStorageFolder(e.target.value);
            eventBus.emit("info", "archive", "Папка хранения обновлена");
          }}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-ags-muted">Записей нет.</p>
      ) : (
        <ul className="space-y-2 overflow-auto">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="rounded border border-ags-border bg-ags-elevated p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-ags-dim">
                    {new Date(c.startedAt).toLocaleString()} · {c.source} ·{" "}
                    {c.sizeBytes > 0
                      ? `${(c.sizeBytes / 1024).toFixed(0)} КБ`
                      : "размер Н/Д"}
                    {c.filePath ? ` · ${c.filePath}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {c.objectUrl && (
                    <button
                      type="button"
                      className="rounded border border-ags-border px-2 py-0.5 text-xs"
                      onClick={() =>
                        setPlaying((p) => (p === c.id ? null : c.id))
                      }
                    >
                      {playing === c.id ? "Скрыть" : "Смотреть"}
                    </button>
                  )}
                  <a
                    className="rounded border border-ags-border px-2 py-0.5 text-xs"
                    href={c.objectUrl}
                    download={`${c.title}.webm`}
                    onClick={(e) => {
                      if (!c.objectUrl) e.preventDefault();
                    }}
                  >
                    Экспорт
                  </a>
                  <button
                    type="button"
                    className="rounded border border-ags-danger/40 px-2 py-0.5 text-xs text-ags-danger"
                    onClick={() => {
                      removeClip(c.id);
                      eventBus.emit("warning", "archive", `Удалено: ${c.title}`);
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
              {playing === c.id && c.objectUrl && (
                <video
                  className="mt-2 max-h-48 w-full rounded bg-black"
                  src={c.objectUrl}
                  controls
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
