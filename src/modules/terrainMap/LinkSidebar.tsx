import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useTerrainMapStore } from "@/stores/terrainMapStore";
import {
  radioVisibilityLabel,
  radioVisibilityTone,
  type RadioVisibilityStatus,
} from "@/services/terrain/fresnel";
import { listAntennaProfiles } from "@/services/catalogs";
import { useEffect, useState } from "react";
import type { AntennaProfile } from "@/services/catalogs";

function ToneDot({ tone }: { tone: "ok" | "warn" | "danger" | "muted" }) {
  const c =
    tone === "ok"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "danger"
          ? "bg-red-400"
          : "bg-ags-dim";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

export function LinkSidebar({
  distanceM,
  deltaHeightM,
  azimuthDeg,
  elevationDeg,
  stationAmsl,
  droneAmsl,
  status,
  demo,
}: {
  distanceM: number | null;
  deltaHeightM: number | null;
  azimuthDeg: number | null;
  elevationDeg: number | null;
  stationAmsl: number | null;
  droneAmsl: number | null;
  status: RadioVisibilityStatus;
  demo: boolean;
}) {
  const az = useStationPlannerStore((s) => s.simAzimuthDeg);
  const el = useStationPlannerStore((s) => s.simElevationDeg);
  const setAz = useStationPlannerStore((s) => s.setSimAzimuthDeg);
  const setEl = useStationPlannerStore((s) => s.setSimElevationDeg);
  const ranges = useStationPlannerStore((s) => s.panTiltRanges);
  const setRanges = useStationPlannerStore((s) => s.setPanTiltRanges);
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const setRangeKm = useStationPlannerStore((s) => s.setRangeKm);
  const videoPatchDeg = useStationPlannerStore((s) => s.videoPatchDeg);
  const setVideoPatchDeg = useStationPlannerStore((s) => s.setVideoPatchDeg);
  const applyPatchesFromCatalog = useStationPlannerStore(
    (s) => s.applyPatchesFromCatalog,
  );
  const factAz = useStationPlannerStore((s) => s.factAzimuthDeg);
  const factEl = useStationPlannerStore((s) => s.factElevationDeg);

  const controlMode = useTerrainMapStore((s) => s.controlMode);
  const setControlMode = useTerrainMapStore((s) => s.setControlMode);
  const freqGhz = useTerrainMapStore((s) => s.freqGhz);
  const setFreqGhz = useTerrainMapStore((s) => s.setFreqGhz);
  const maxRangeKm = useTerrainMapStore((s) => s.maxRangeKm);
  const setMaxRangeKm = useTerrainMapStore((s) => s.setMaxRangeKm);
  const demoMode = useTerrainMapStore((s) => s.demoMode);
  const setDemoMode = useTerrainMapStore((s) => s.setDemoMode);

  const [antennas, setAntennas] = useState<AntennaProfile[]>([]);
  const [antennaId, setAntennaId] = useState("");

  useEffect(() => {
    void listAntennaProfiles().then(setAntennas);
  }, []);

  const nd = (v: number | null | undefined, digits = 1, unit = "") =>
    v == null || Number.isNaN(v) ? "Нет данных" : `${v.toFixed(digits)}${unit}`;

  const tone = radioVisibilityTone(status);

  // Auto-aim toward computed azimuth when in auto mode
  useEffect(() => {
    if (controlMode !== "auto" || azimuthDeg == null) return;
    let signed = azimuthDeg > 180 ? azimuthDeg - 360 : azimuthDeg;
    signed = Math.min(ranges.azMax, Math.max(ranges.azMin, signed));
    setAz(signed);
    if (elevationDeg != null) {
      setEl(Math.min(ranges.elMax, Math.max(ranges.elMin, elevationDeg)));
    }
  }, [
    controlMode,
    azimuthDeg,
    elevationDeg,
    ranges.azMax,
    ranges.azMin,
    ranges.elMax,
    ranges.elMin,
    setAz,
    setEl,
  ]);

  return (
    <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col gap-2 overflow-auto border-l border-ags-border-subtle bg-ags-panel/95 p-3 text-xs backdrop-blur-md">
      {demo && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
          DEMO MODE — расчёты и углы симуляции; команды ESP32 не отправляются
        </div>
      )}

      <section className="space-y-1.5 rounded border border-ags-border/60 p-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          Параметры связи
        </h3>
        <div className="flex items-center gap-2 text-[11px]">
          <ToneDot tone={tone} />
          <span>{radioVisibilityLabel(status)}</span>
        </div>
        <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1 font-mono text-[11px]">
          <dt className="text-ags-dim">Расстояние</dt>
          <dd>{nd(distanceM != null ? distanceM / 1000 : null, 2, " км")}</dd>
          <dt className="text-ags-dim">Перепад высот</dt>
          <dd>
            {deltaHeightM == null
              ? "Нет данных"
              : `${deltaHeightM >= 0 ? "+" : ""}${deltaHeightM.toFixed(0)} м`}
          </dd>
          <dt className="text-ags-dim">Азимут</dt>
          <dd>{nd(azimuthDeg, 1, "°")}</dd>
          <dt className="text-ags-dim">Угол места</dt>
          <dd>{nd(elevationDeg, 2, "°")}</dd>
          <dt className="text-ags-dim">Высота НСУ</dt>
          <dd>{nd(stationAmsl, 0, " м")}</dd>
          <dt className="text-ags-dim">Высота дрона</dt>
          <dd>{nd(droneAmsl, 0, " м")}</dd>
          <dt className="text-ags-dim">Частота</dt>
          <dd>{freqGhz.toFixed(2)} ГГц</dd>
        </dl>
      </section>

      <section className="space-y-2 rounded border border-ags-border/60 p-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          Поворотный механизм
        </h3>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["manual", "Ручной"],
              ["auto", "Авто"],
              ["hold", "Удержание"],
              ["center", "Центр"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                controlMode === id
                  ? "rounded bg-ags-accent px-2 py-0.5 text-[10px] text-white"
                  : "rounded border border-ags-border px-2 py-0.5 text-[10px]"
              }
              onClick={() => setControlMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-[11px] text-ags-muted">
          PAN заданный ({ranges.azMin}…{ranges.azMax}°)
          <input
            type="range"
            className="mt-1 w-full"
            min={ranges.azMin}
            max={ranges.azMax}
            step={0.5}
            value={az}
            disabled={controlMode === "auto" || controlMode === "hold"}
            onChange={(e) => setAz(Number(e.target.value))}
          />
          <span className="font-mono text-ags-fg">{az.toFixed(1)}°</span>
        </label>
        <label className="block text-[11px] text-ags-muted">
          TILT заданный ({ranges.elMin}…{ranges.elMax}°)
          <input
            type="range"
            className="mt-1 w-full"
            min={ranges.elMin}
            max={ranges.elMax}
            step={0.5}
            value={el}
            disabled={controlMode === "auto" || controlMode === "hold"}
            onChange={(e) => setEl(Number(e.target.value))}
          />
          <span className="font-mono text-ags-fg">{el.toFixed(1)}°</span>
        </label>
        <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1 font-mono text-[11px]">
          <dt className="text-ags-dim">PAN факт</dt>
          <dd>{factAz == null ? "Нет данных" : `${factAz.toFixed(1)}°`}</dd>
          <dt className="text-ags-dim">TILT факт</dt>
          <dd>{factEl == null ? "Нет данных" : `${factEl.toFixed(1)}°`}</dd>
        </dl>
        <p className="text-[10px] text-ags-dim">
          Географический азимут ≠ угол серво. LIVE write на ESP32 — отдельный
          OK; сейчас только симуляция / COM read.
        </p>
      </section>

      <section className="space-y-2 rounded border border-ags-border/60 p-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          Радиус и антенна
        </h3>
        <label className="block text-[11px] text-ags-muted">
          Радиус действия (1…{maxRangeKm} км)
          <input
            type="range"
            className="mt-1 w-full"
            min={1}
            max={maxRangeKm}
            step={1}
            value={rangeKm}
            onChange={(e) => setRangeKm(Number(e.target.value))}
          />
          <span className="font-mono text-ags-fg">{rangeKm.toFixed(0)} км</span>
        </label>
        <p className="text-[10px] text-ags-dim">
          Настроенный радиус ≠ гарантированная дальность RF.
        </p>
        <label className="block text-[11px] text-ags-muted">
          Ширина патча (гориз.)
          <input
            type="range"
            className="mt-1 w-full"
            min={5}
            max={180}
            step={1}
            value={videoPatchDeg}
            onChange={(e) => setVideoPatchDeg(Number(e.target.value))}
          />
          <span className="font-mono text-ags-fg">{videoPatchDeg}°</span>
        </label>
        <label className="block text-[11px] text-ags-muted">
          Профиль антенны
          <select
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-2 py-1"
            value={antennaId}
            onChange={(e) => {
              setAntennaId(e.target.value);
              const a = antennas.find((x) => x.id === e.target.value);
              if (a?.beamwidthDeg != null) setVideoPatchDeg(a.beamwidthDeg);
            }}
          >
            <option value="">— каталог —</option>
            {antennas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.gainDbi != null ? ` · ${a.gainDbi} dBi` : ""}
                {a.beamwidthDeg == null ? " · beamwidth Н/Д" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1 text-[10px]"
          onClick={() => void applyPatchesFromCatalog()}
        >
          Патчи из mounts станции
        </button>
      </section>

      <section className="space-y-2 rounded border border-ags-border/60 p-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          Настройки
        </h3>
        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
          />
          DEMO MODE
        </label>
        <label className="block text-[11px] text-ags-muted">
          Макс. радиус настроек
          <input
            type="range"
            className="mt-1 w-full"
            min={5}
            max={100}
            step={1}
            value={maxRangeKm}
            onChange={(e) => setMaxRangeKm(Number(e.target.value))}
          />
          <span className="font-mono">{maxRangeKm} км</span>
        </label>
        <label className="block text-[11px] text-ags-muted">
          Частота (ГГц)
          <select
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-2 py-1"
            value={String(freqGhz)}
            onChange={(e) => setFreqGhz(Number(e.target.value))}
          >
            <option value="2.4">2.4 GHz</option>
            <option value="5.8">5.8 GHz (Patch)</option>
            <option value="1.2">1.2 GHz</option>
          </select>
        </label>
        <label className="block text-[11px] text-ags-muted">
          PAN limits ±
          <input
            type="range"
            className="mt-1 w-full"
            min={30}
            max={180}
            step={5}
            value={Math.abs(ranges.azMax)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRanges({ azMin: -v, azMax: v });
            }}
          />
          <span className="font-mono">
            ±{Math.abs(ranges.azMax)}°
          </span>
        </label>
        <label className="block text-[11px] text-ags-muted">
          TILT max
          <input
            type="range"
            className="mt-1 w-full"
            min={30}
            max={90}
            step={1}
            value={ranges.elMax}
            onChange={(e) => setRanges({ elMax: Number(e.target.value) })}
          />
          <span className="font-mono">0…{ranges.elMax}°</span>
        </label>
      </section>
    </aside>
  );
}
