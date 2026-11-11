import {
  useStationPlannerStore,
  type PanTiltMode,
} from "@/stores/stationPlannerStore";
import { PanTiltScene3D } from "./PanTiltScene3D";

export type { PanTiltMode };

/** Compact 2D compass for azimuth. */
function AzimuthCompass({ az }: { az: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 text-ags-fg">
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <text x="50" y="14" textAnchor="middle" fontSize="8" fill="currentColor">
        N
      </text>
      <line
        x1="50"
        y1="50"
        x2={50 + 38 * Math.sin((az * Math.PI) / 180)}
        y2={50 - 38 * Math.cos((az * Math.PI) / 180)}
        stroke="#3d8bfd"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="3" fill="#3d8bfd" />
    </svg>
  );
}

/**
 * Pan-Tilt Manager — Simulation / Monitoring / Local Device Status.
 * No remote actuator commands (ТЗ §8 / §14 safety boundary).
 */
export function PanTiltPanel({ compact = false }: { compact?: boolean }) {
  const mode = useStationPlannerStore((s) => s.panTiltMode);
  const setMode = useStationPlannerStore((s) => s.setPanTiltMode);
  const az = useStationPlannerStore((s) => s.simAzimuthDeg);
  const el = useStationPlannerStore((s) => s.simElevationDeg);
  const setAz = useStationPlannerStore((s) => s.setSimAzimuthDeg);
  const setEl = useStationPlannerStore((s) => s.setSimElevationDeg);
  const reset = useStationPlannerStore((s) => s.resetSimZero);
  const ranges = useStationPlannerStore((s) => s.panTiltRanges);
  const factAz = useStationPlannerStore((s) => s.factAzimuthDeg);
  const factEl = useStationPlannerStore((s) => s.factElevationDeg);
  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const st = stations.find((s) => s.id === activeStationId);

  const displayAz = mode === "simulation" ? az : factAz;
  const displayEl = mode === "simulation" ? el : factEl;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-2 text-sm">
      {!compact && (
        <p className="text-[10px] text-ags-muted">
          Удалённое управление приводами не реализуется. Simulation меняет только
          виртуальную модель, карту и профиль.
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["simulation", "Симуляция"],
            ["monitoring", "Мониторинг"],
            ["local-status", "Лок. статус"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              mode === id
                ? "rounded bg-ags-accent px-2 py-0.5 text-xs text-white"
                : "rounded border border-ags-border px-2 py-0.5 text-xs"
            }
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <AzimuthCompass az={displayAz ?? 0} />
        <dl className="grid flex-1 grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-xs">
          <dt className="text-ags-dim">Азимут sim</dt>
          <dd className="font-mono">{az.toFixed(1)}°</dd>
          <dt className="text-ags-dim">Угол места sim</dt>
          <dd className="font-mono">{el.toFixed(1)}°</dd>
          <dt className="text-ags-dim">Азимут факт</dt>
          <dd className="font-mono">
            {factAz == null ? "Н/Д" : `${factAz.toFixed(1)}°`}
          </dd>
          <dt className="text-ags-dim">Угол места факт</dt>
          <dd className="font-mono">
            {factEl == null ? "Н/Д" : `${factEl.toFixed(1)}°`}
          </dd>
          <dt className="text-ags-dim">Источник</dt>
          <dd>{mode === "simulation" ? "Симуляция" : "Устройство / Н/Д"}</dd>
        </dl>
      </div>

      {mode === "simulation" && (
        <div className="space-y-2">
          <label className="block text-xs text-ags-muted">
            Азимут ({ranges.azMin}…{ranges.azMax}°)
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min={ranges.azMin}
                max={ranges.azMax}
                step={0.5}
                value={az}
                onChange={(e) => setAz(Number(e.target.value))}
                className="min-w-0 flex-1"
                aria-label="Азимут"
              />
              <input
                type="number"
                className="w-16 rounded border border-ags-border bg-ags-elevated px-1 py-0.5 font-mono"
                value={az}
                min={ranges.azMin}
                max={ranges.azMax}
                step={0.1}
                onChange={(e) => setAz(Number(e.target.value))}
                aria-label="Азимут числом"
              />
            </div>
          </label>
          <label className="block text-xs text-ags-muted">
            Угол места ({ranges.elMin}…{ranges.elMax}°)
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min={ranges.elMin}
                max={ranges.elMax}
                step={0.5}
                value={el}
                onChange={(e) => setEl(Number(e.target.value))}
                className="min-w-0 flex-1"
                aria-label="Угол места"
              />
              <input
                type="number"
                className="w-16 rounded border border-ags-border bg-ags-elevated px-1 py-0.5 font-mono"
                value={el}
                min={ranges.elMin}
                max={ranges.elMax}
                step={0.1}
                onChange={(e) => setEl(Number(e.target.value))}
                aria-label="Угол места числом"
              />
            </div>
          </label>
          <button
            type="button"
            className="rounded border border-ags-border px-2 py-1 text-xs"
            onClick={() => reset()}
          >
            Сброс в 0°
          </button>
        </div>
      )}

      {mode === "monitoring" && (
        <p className="text-xs text-ags-dim">
          Нет подключённого адаптера поворотного механизма — фактические углы
          Н/Д. Отображается только симуляция для геометрии.
        </p>
      )}

      {mode === "local-status" && (
        <p className="text-xs text-ags-dim">
          Ожидается локальный адаптер (COM/USB). Команды поворота на железо из
          этого режима не отправляются.
        </p>
      )}

      {!compact && (
        <PanTiltScene3D
          azimuthDeg={displayAz ?? az}
          elevationDeg={displayEl ?? el}
          mastHeightM={st?.mastHeightM}
          className="mt-1 min-h-[180px] flex-1 rounded border border-ags-border"
        />
      )}
    </div>
  );
}
