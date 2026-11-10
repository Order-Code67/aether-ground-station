import { useEffect, useState } from "react";
import { eventBus } from "@/services/events/eventBus";

export type PanTiltMode = "simulation" | "monitoring" | "local-status";

/**
 * Pan-Tilt Manager — Simulation / Monitoring / Local Device Status.
 * No remote actuator commands (ТЗ §14 safety boundary).
 */
export function PanTiltPanel() {
  const [mode, setMode] = useState<PanTiltMode>("simulation");
  const [azimuth, setAzimuth] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [reportedAz, setReportedAz] = useState<number | null>(null);
  const [reportedEl, setReportedEl] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [linkOk, setLinkOk] = useState(true);

  useEffect(() => {
    if (mode !== "monitoring") return;
    // Monitoring: values would come from device adapter — no fake stream.
    setReportedAz(null);
    setReportedEl(null);
    setLastUpdate(null);
    setLinkOk(false);
    eventBus.emit(
      "warning",
      "pan-tilt",
      "Monitoring: нет подключённого адаптера поворотного механизма",
    );
  }, [mode]);

  const displayAz = mode === "simulation" ? azimuth : reportedAz;
  const displayEl = mode === "simulation" ? elevation : reportedEl;

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-sm">
      <p className="text-xs text-ags-muted">
        Удалённое управление исполнительными механизмами через интернет не
        реализуется. Simulation меняет только виртуальную модель.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["simulation", "Simulation"],
            ["monitoring", "Monitoring"],
            ["local-status", "Local Device Status"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              mode === id
                ? "rounded bg-ags-accent px-2 py-1 text-white"
                : "rounded border border-ags-border px-2 py-1"
            }
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-2 rounded border border-ags-border bg-ags-elevated p-3">
        <dt className="text-ags-dim">Azimuth</dt>
        <dd className="font-mono">
          {displayAz == null ? "N/A" : `${displayAz.toFixed(1)}°`}
        </dd>
        <dt className="text-ags-dim">Elevation</dt>
        <dd className="font-mono">
          {displayEl == null ? "N/A" : `${displayEl.toFixed(1)}°`}
        </dd>
        <dt className="text-ags-dim">Связь</dt>
        <dd>{mode === "simulation" ? "virt" : linkOk ? "OK" : "потеряна / нет устройства"}</dd>
        <dt className="text-ags-dim">Обновлено</dt>
        <dd className="font-mono text-xs">{lastUpdate ?? "—"}</dd>
      </dl>

      {mode === "simulation" && (
        <div className="max-w-md space-y-3">
          <label className="block text-xs text-ags-muted">
            Horizontal / Azimuth
            <input
              type="range"
              min={0}
              max={360}
              value={azimuth}
              onChange={(e) => setAzimuth(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-ags-muted">
            Vertical / Elevation
            <input
              type="range"
              min={-10}
              max={90}
              value={elevation}
              onChange={(e) => setElevation(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        </div>
      )}

      {mode === "local-status" && (
        <p className="text-xs text-ags-dim">
          Ожидается локальный адаптер pan-tilt. Диагностика появится после
          подключения устройства (COM/USB). Команды поворота на железо из этого
          режима не отправляются без явного локального адаптера.
        </p>
      )}
    </div>
  );
}
