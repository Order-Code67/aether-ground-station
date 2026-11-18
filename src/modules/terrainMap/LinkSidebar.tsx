import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { useTerrainMapStore } from "@/stores/terrainMapStore";
import { useGisStore } from "@/stores/gisStore";
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
}: {
  distanceM: number | null;
  deltaHeightM: number | null;
  azimuthDeg: number | null;
  elevationDeg: number | null;
  stationAmsl: number | null;
  droneAmsl: number | null;
  status: RadioVisibilityStatus;
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
  const pickStationPos = useStationPlannerStore((s) => s.pickStationPos);
  const pickLookAt = useStationPlannerStore((s) => s.pickLookAt);
  const pickMarker = useStationPlannerStore((s) => s.pickMarker);
  const setPickStationPos = useStationPlannerStore((s) => s.setPickStationPos);
  const setPickLookAt = useStationPlannerStore((s) => s.setPickLookAt);
  const setPickMarker = useStationPlannerStore((s) => s.setPickMarker);
  const mapMarkers = useStationPlannerStore((s) => s.mapMarkers);
  const removeMapMarker = useStationPlannerStore((s) => s.removeMapMarker);
  const clearMapMarkers = useStationPlannerStore((s) => s.clearMapMarkers);
  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const setActiveStationId = useStationPlannerStore((s) => s.setActiveStationId);
  const removeStation = useStationPlannerStore((s) => s.removeStation);
  const lookAt = useStationPlannerStore((s) => s.lookAt);
  const st = stations.find((s) => s.id === activeStationId);

  const controlMode = useTerrainMapStore((s) => s.controlMode);
  const setControlMode = useTerrainMapStore((s) => s.setControlMode);
  const freqGhz = useTerrainMapStore((s) => s.freqGhz);
  const setFreqGhz = useTerrainMapStore((s) => s.setFreqGhz);
  const maxRangeKm = useTerrainMapStore((s) => s.maxRangeKm);
  const setMaxRangeKm = useTerrainMapStore((s) => s.setMaxRangeKm);
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

  const pickBtn = (on: boolean) =>
    on
      ? "rounded bg-ags-accent px-2 py-1 text-[10px] text-white"
      : "rounded border border-ags-border px-2 py-1 text-[10px]";

  return (
    <aside className="flex h-full min-h-0 w-[18.5rem] shrink-0 flex-col gap-2.5 overflow-auto border-l border-ags-border-subtle bg-ags-panel/95 p-3 text-xs backdrop-blur-md">
      <section className="ags-panel space-y-2.5 p-2.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          Объекты на карте
        </h3>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={pickBtn(pickStationPos)}
            onClick={() => {
              const next = !pickStationPos;
              setPickStationPos(next);
              if (next) {
                useGisStore.getState().setTool("none");
                useGisStore.getState().setBottomPanelOpen(true);
                useTerrainMapStore.getState().setTab("map");
              }
            }}
          >
            {pickStationPos ? "Клик: НСУ…" : "Поставить НСУ"}
          </button>
          <button
            type="button"
            className={pickBtn(pickLookAt)}
            onClick={() => {
              const next = !pickLookAt;
              setPickLookAt(next);
              if (next) {
                useGisStore.getState().setTool("none");
                useGisStore.getState().setBottomPanelOpen(true);
                useTerrainMapStore.getState().setTab("map");
              }
            }}
          >
            {pickLookAt ? "Клик: цель…" : "Поставить цель B"}
          </button>
          <button
            type="button"
            className={pickBtn(pickMarker)}
            onClick={() => {
              const next = !pickMarker;
              setPickMarker(next);
              if (next) {
                useGisStore.getState().setTool("none");
                useTerrainMapStore.getState().setTab("map");
              }
            }}
          >
            {pickMarker ? "Клик: точка…" : "Своя точка"}
          </button>
        </div>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 font-mono text-[10px]">
          <dt className="text-ags-dim">НСУ</dt>
          <dd>
            {st
              ? `${st.latitude.toFixed(5)}, ${st.longitude.toFixed(5)}`
              : "не задана — клик по карте"}
          </dd>
          <dt className="text-ags-dim">Цель B</dt>
          <dd>
            {lookAt
              ? `${lookAt.lat.toFixed(5)}, ${lookAt.lng.toFixed(5)}`
              : "не задана"}
          </dd>
        </dl>
        {stations.length > 0 && (
          <ul className="max-h-36 space-y-1 overflow-auto">
            {stations.map((s) => {
              const active = s.id === activeStationId;
              return (
                <li
                  key={s.id}
                  className={
                    active
                      ? "flex items-center gap-1 rounded border border-ags-accent/40 bg-ags-elevated px-1.5 py-1"
                      : "flex items-center gap-1 rounded bg-ags-elevated/60 px-1.5 py-1"
                  }
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-mono text-[10px]"
                    onClick={() => setActiveStationId(s.id)}
                    title="Сделать активной"
                  >
                    <span className={active ? "text-amber-300" : "text-ags-fg"}>
                      {active ? "● " : ""}
                      {s.name}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-ags-dim">
                      {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                      {s.terrainElevationM != null
                        ? ` · H ${s.terrainElevationM.toFixed(0)} м`
                        : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-ags-danger hover:bg-red-500/20"
                    title="Удалить НСУ с карты"
                    onClick={() => void removeStation(s.id)}
                  >
                    Удал.
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {mapMarkers.length > 0 && (
          <ul className="max-h-28 space-y-1 overflow-auto">
            {mapMarkers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-1 rounded bg-ags-elevated/80 px-1.5 py-0.5"
              >
                <span className="truncate font-mono text-[10px]">
                  {m.label}: {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-[10px] text-ags-warning"
                  onClick={() => removeMapMarker(m.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {mapMarkers.length > 0 && (
          <button
            type="button"
            className="text-[10px] text-ags-dim underline"
            onClick={() => clearMapMarkers()}
          >
            Очистить точки
          </button>
        )}
        <p className="text-[10px] text-ags-dim">
          Режим постановки: кнопка → клик по карте. Станцию из дерева выбирать не
          нужно.
        </p>
      </section>

      <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2">
        <p className="text-[9px] leading-snug text-ags-dim">
          Радиовидимость по DEM/Френелю — геометрия, не качество канала. Помехи,
          многолучевость и объекты вне DEM не учитываются.
        </p>
      </section>

      {st && (
        <section className="ags-panel space-y-1.5 p-2.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
            Станция (НСУ)
          </h3>
          <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1 font-mono text-[11px]">
            <dt className="text-ags-dim">Координаты</dt>
            <dd>
              {st.latitude.toFixed(5)}, {st.longitude.toFixed(5)}
            </dd>
            <dt className="text-ags-dim">Рельеф</dt>
            <dd>
              {st.terrainElevationM == null
                ? "Н/Д"
                : `${st.terrainElevationM.toFixed(0)} м`}
            </dd>
            <dt className="text-ags-dim">Мачта (над землёй)</dt>
            <dd>{st.mastHeightM ?? 15} м</dd>
            <dt className="text-ags-dim">Антенна AMSL</dt>
            <dd>{nd(stationAmsl, 0, " м")}</dd>
          </dl>
        </section>
      )}

      <section className="ags-panel space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
            Параметры связи
          </h3>
          <div className="flex items-center gap-1.5 text-[11px]">
            <ToneDot tone={tone} />
            <span className="font-medium">{radioVisibilityLabel(status)}</span>
          </div>
        </div>
        <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1 font-mono text-[11px]">
          <dt className="text-ags-dim">Расстояние</dt>
          <dd>{nd(distanceM != null ? distanceM / 1000 : null, 2, " км")}</dd>
          <dt className="text-ags-dim">Перепад высот</dt>
          <dd title="Цель AMSL − антенна НСУ AMSL по линии направления">
            {deltaHeightM == null
              ? "Нет данных — поставьте НСУ и цель B"
              : `${deltaHeightM >= 0 ? "+" : ""}${deltaHeightM.toFixed(0)} м`}
          </dd>
          <dt className="text-ags-dim">Азимут</dt>
          <dd>{nd(azimuthDeg, 1, "°")}</dd>
          <dt className="text-ags-dim">Угол места</dt>
          <dd>{nd(elevationDeg, 2, "°")}</dd>
          <dt className="text-ags-dim">НСУ (антенна)</dt>
          <dd>{nd(stationAmsl, 0, " м")}</dd>
          <dt className="text-ags-dim">Цель / рельеф</dt>
          <dd>{nd(droneAmsl, 0, " м")}</dd>
          <dt className="text-ags-dim">Частота</dt>
          <dd>{freqGhz.toFixed(2)} ГГц</dd>
        </dl>
      </section>

      <section className="ags-panel space-y-2.5 p-2.5">
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
        <div className="space-y-2.5">
          <label className="block text-[11px] text-ags-muted">
            <span className="mb-1 flex items-center justify-between gap-2">
              <span>
                PAN ({ranges.azMin}…{ranges.azMax}°)
              </span>
              <span className="shrink-0 rounded bg-ags-elevated px-1.5 py-0.5 font-mono text-ags-fg">
                {az.toFixed(1)}°
              </span>
            </span>
            <input
              type="range"
              className="w-full"
              min={ranges.azMin}
              max={ranges.azMax}
              step={0.5}
              value={az}
              disabled={controlMode === "auto" || controlMode === "hold"}
              onChange={(e) => setAz(Number(e.target.value))}
            />
          </label>
          <label className="block text-[11px] text-ags-muted">
            <span className="mb-1 flex items-center justify-between gap-2">
              <span>
                TILT ({ranges.elMin}…{ranges.elMax}°)
              </span>
              <span className="shrink-0 rounded bg-ags-elevated px-1.5 py-0.5 font-mono text-ags-fg">
                {el.toFixed(1)}°
              </span>
            </span>
            <input
              type="range"
              className="w-full"
              min={ranges.elMin}
              max={ranges.elMax}
              step={0.5}
              value={el}
              disabled={controlMode === "auto" || controlMode === "hold"}
              onChange={(e) => setEl(Number(e.target.value))}
            />
          </label>
        </div>
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

      <section className="ags-panel space-y-2.5 p-2.5">
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
