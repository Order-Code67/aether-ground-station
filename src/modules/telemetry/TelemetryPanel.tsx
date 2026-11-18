import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/services/tauri";
import { eventBus } from "@/services/events/eventBus";
import {
  exportTelemetryCsv,
  listTelemetryAdapters,
  normalizeTelemetryLine,
  type NormalizedTelemetry,
  type TelemetryAdapterId,
  type TelemetrySample,
} from "@/services/telemetry/normalize";
import {
  appendTelemetryRecord,
  listTelemetryRecords,
} from "@/services/inventory";

function buildSpark(
  vals: number[],
  w: number,
  h: number,
): { pts: string; min: number; max: number } | null {
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return { pts, min, max };
}

/**
 * Monitor-only telemetry — adapters normalize wire formats; no uplink commands.
 */
export function TelemetryPanel() {
  const adapters = listTelemetryAdapters();
  const [preferred, setPreferred] = useState<TelemetryAdapterId>("esp32-json");
  const [latest, setLatest] = useState<NormalizedTelemetry | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [rawErrors, setRawErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void (async () => {
      try {
        const rows = await listTelemetryRecords(200);
        const samples: TelemetrySample[] = [];
        let newest: NormalizedTelemetry | null = null;
        for (const row of rows) {
          try {
            const msg = JSON.parse(row.payload) as NormalizedTelemetry;
            if (!newest) newest = msg;
            samples.push({
              at: row.at,
              voltageV: msg.voltageV ?? null,
              temperatureC: msg.temperatureC ?? null,
              latitude: msg.latitude ?? null,
              longitude: msg.longitude ?? null,
              altitudeM: msg.altitudeM ?? null,
              adapterId: msg.adapterId ?? null,
            });
          } catch {
            /* skip corrupt */
          }
        }
        if (samples.length) setHistory(samples);
        if (newest) setLatest(newest);
      } catch {
        /* preview / empty DB */
      }
    })();
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<{ data: string }>("serial-data", (ev) => {
        const line = ev.payload.data.trim();
        if (!line.startsWith("{")) return;
        const msg = normalizeTelemetryLine(line, preferred);
        if (!msg) {
          setRawErrors((prev) =>
            [`Некорректный кадр: ${line.slice(0, 80)}`, ...prev].slice(0, 20),
          );
          return;
        }
        setLatest(msg);
        setHistory((prev) =>
          [
            {
              at: msg.receivedAt,
              voltageV: msg.voltageV,
              temperatureC: msg.temperatureC,
              latitude: msg.latitude,
              longitude: msg.longitude,
              altitudeM: msg.altitudeM,
              adapterId: msg.adapterId ?? null,
            },
            ...prev,
          ].slice(0, 200),
        );
        void appendTelemetryRecord({
          id: `tel_${Date.now().toString(36)}`,
          deviceId: msg.deviceId,
          at: msg.receivedAt,
          payload: JSON.stringify(msg),
        });
        eventBus.emit(
          "info",
          "telemetry",
          `${msg.deviceLabel} · ${msg.rawStatus}`,
        );
        for (const w of msg.warnings) {
          if (w.startsWith("Статус:")) {
            eventBus.emit("warning", "telemetry", w);
          }
        }
      });
    })();
    return () => unlisten?.();
  }, [preferred]);

  const voltSpark = useMemo(() => {
    const vals = history
      .map((h) => h.voltageV)
      .filter((v): v is number => v != null)
      .slice(0, 60)
      .reverse();
    return buildSpark(vals, 220, 48);
  }, [history]);

  const tempSpark = useMemo(() => {
    const vals = history
      .map((h) => h.temperatureC)
      .filter((v): v is number => v != null)
      .slice(0, 60)
      .reverse();
    return buildSpark(vals, 220, 48);
  }, [history]);

  const exportCsv = () => {
    const csv = exportTelemetryCsv(history);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ags-telemetry-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    eventBus.emit("info", "telemetry", "Экспорт CSV");
  };

  const nd = (v: number | null | undefined, unit = "") =>
    v == null || Number.isNaN(v) ? "нет данных" : `${v}${unit}`;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ags-muted">
          Monitor-only · адаптеры нормализации · без uplink / MAVLink команд.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ags-muted">
            Адаптер
            <select
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1 text-ags-fg"
              value={preferred}
              onChange={(e) =>
                setPreferred(e.target.value as TelemetryAdapterId)
              }
            >
              {adapters.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={history.length === 0}
            className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
            onClick={exportCsv}
          >
            Экспорт CSV
          </button>
        </div>
      </div>
      {!latest ? (
        <div className="rounded border border-dashed border-ags-border p-4 text-ags-dim">
          Нет телеметрии. Подключите контроллер в COM и отправьте JSON.
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded border border-ags-border bg-ags-elevated p-3">
            <dt className="text-ags-dim">Устройство</dt>
            <dd>{latest.deviceLabel}</dd>
            <dt className="text-ags-dim">Адаптер</dt>
            <dd>{latest.adapterId ?? "—"}</dd>
            <dt className="text-ags-dim">Прошивка</dt>
            <dd>{latest.firmware || "—"}</dd>
            <dt className="text-ags-dim">Online</dt>
            <dd>{latest.online ? "да" : "нет"}</dd>
            <dt className="text-ags-dim">Напряжение</dt>
            <dd>
              {latest.voltageV === null
                ? "нет данных"
                : `${latest.voltageV} В`}
            </dd>
            <dt className="text-ags-dim">Температура</dt>
            <dd>
              {latest.temperatureC === null
                ? "нет данных"
                : `${latest.temperatureC} °C`}
            </dd>
            <dt className="text-ags-dim">Широта</dt>
            <dd className="font-mono">{nd(latest.latitude)}</dd>
            <dt className="text-ags-dim">Долгота</dt>
            <dd className="font-mono">{nd(latest.longitude)}</dd>
            <dt className="text-ags-dim">Высота</dt>
            <dd>{nd(latest.altitudeM, " м")}</dd>
          </dl>
          {latest.warnings.length > 0 && (
            <ul className="text-xs text-ags-warning">
              {latest.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {voltSpark && (
              <div className="rounded border border-ags-border bg-ags-elevated p-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-ags-dim">
                  V ({voltSpark.min.toFixed(2)}…{voltSpark.max.toFixed(2)})
                </div>
                <svg width={220} height={48} className="text-ags-accent">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    points={voltSpark.pts}
                  />
                </svg>
              </div>
            )}
            {tempSpark && (
              <div className="rounded border border-ags-border bg-ags-elevated p-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-ags-dim">
                  T° ({tempSpark.min.toFixed(1)}…{tempSpark.max.toFixed(1)})
                </div>
                <svg width={220} height={48} className="text-amber-400">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    points={tempSpark.pts}
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="text-[11px] text-ags-dim">
            Буфер: {history.length} · без команд на борт
          </div>
        </>
      )}
      {rawErrors.length > 0 && (
        <div className="text-xs text-ags-warning">
          {rawErrors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
