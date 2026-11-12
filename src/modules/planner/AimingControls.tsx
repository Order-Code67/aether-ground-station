import { useStationPlannerStore } from "@/stores/stationPlannerStore";

/**
 * Manual station aiming — point, heading, range, patches, mast, servos.
 * No mode pickers / extra feature menus.
 */
export function AimingControls() {
  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const st = stations.find((s) => s.id === activeStationId);

  const az = useStationPlannerStore((s) => s.simAzimuthDeg);
  const el = useStationPlannerStore((s) => s.simElevationDeg);
  const setAz = useStationPlannerStore((s) => s.setSimAzimuthDeg);
  const setEl = useStationPlannerStore((s) => s.setSimElevationDeg);
  const ranges = useStationPlannerStore((s) => s.panTiltRanges);
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const setRangeKm = useStationPlannerStore((s) => s.setRangeKm);
  const videoPatchDeg = useStationPlannerStore((s) => s.videoPatchDeg);
  const controlPatchDeg = useStationPlannerStore((s) => s.controlPatchDeg);
  const setVideoPatchDeg = useStationPlannerStore((s) => s.setVideoPatchDeg);
  const setControlPatchDeg = useStationPlannerStore((s) => s.setControlPatchDeg);
  const pickLookAt = useStationPlannerStore((s) => s.pickLookAt);
  const pickStationPos = useStationPlannerStore((s) => s.pickStationPos);
  const setPickLookAt = useStationPlannerStore((s) => s.setPickLookAt);
  const setPickStationPos = useStationPlannerStore((s) => s.setPickStationPos);
  const setMastHeightM = useStationPlannerStore((s) => s.setMastHeightM);
  const showFlightCorridor = useStationPlannerStore((s) => s.showFlightCorridor);
  const setShowFlightCorridor = useStationPlannerStore(
    (s) => s.setShowFlightCorridor,
  );
  const showRadioHorizon = useStationPlannerStore((s) => s.showRadioHorizon);
  const setShowRadioHorizon = useStationPlannerStore((s) => s.setShowRadioHorizon);
  const reset = useStationPlannerStore((s) => s.resetSimZero);

  const mast = st?.mastHeightM ?? 15;

  if (!st) {
    return (
      <div className="p-3 text-xs text-ags-muted">
        Выберите станцию — затем точка, направление и серво вручную.
      </div>
    );
  }

  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (n: number) => void,
    unit: string,
  ) => (
    <label className="block text-[11px] text-ags-muted">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-ags-fg">
          {Number.isInteger(step) ? value : value.toFixed(1)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        className="mt-1 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-xs">
      <div>
        <h3 className="text-sm font-semibold text-ags-fg">{st.name}</h3>
        <p className="font-mono text-[10px] text-ags-dim">
          {st.latitude.toFixed(5)}, {st.longitude.toFixed(5)}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={
            pickStationPos
              ? "rounded bg-ags-accent px-2 py-1 text-white"
              : "rounded border border-ags-border px-2 py-1"
          }
          onClick={() => setPickStationPos(!pickStationPos)}
        >
          {pickStationPos ? "Клик: точка…" : "Точка станции"}
        </button>
        <button
          type="button"
          className={
            pickLookAt
              ? "rounded bg-ags-accent px-2 py-1 text-white"
              : "rounded border border-ags-border px-2 py-1"
          }
          onClick={() => setPickLookAt(!pickLookAt)}
        >
          {pickLookAt ? "Клик: направление…" : "Направление полёта"}
        </button>
      </div>

      {slider(
        "Направление (серво AZ)",
        az,
        ranges.azMin,
        ranges.azMax,
        0.5,
        setAz,
        "°",
      )}
      {slider(
        "Угол места (серво EL)",
        el,
        ranges.elMin,
        ranges.elMax,
        0.5,
        setEl,
        "°",
      )}
      {slider("Радиус действия", rangeKm, 1, 150, 1, setRangeKm, " км")}
      {slider("Патч видео", videoPatchDeg, 5, 180, 1, setVideoPatchDeg, "°")}
      {slider(
        "Патч управление",
        controlPatchDeg,
        5,
        180,
        1,
        setControlPatchDeg,
        "°",
      )}
      {slider(
        "Высота мачты",
        mast,
        1,
        80,
        0.5,
        (m) => void setMastHeightM(m),
        " м",
      )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={
            showFlightCorridor
              ? "rounded bg-ags-accent/80 px-2 py-1 text-white"
              : "rounded border border-ags-border px-2 py-1"
          }
          onClick={() => setShowFlightCorridor(!showFlightCorridor)}
        >
          Коридор высот
        </button>
        <button
          type="button"
          className={
            showRadioHorizon
              ? "rounded bg-ags-accent/80 px-2 py-1 text-white"
              : "rounded border border-ags-border px-2 py-1"
          }
          onClick={() => setShowRadioHorizon(!showRadioHorizon)}
        >
          Радиогоризонт
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={() => reset()}
        >
          Серво 0°
        </button>
      </div>

      <p className="text-[10px] leading-snug text-ags-dim">
        Патчи и коридор — геометрия на карте. Перепад высот по DEM; выше мачта —
        дальше просвет. Серво двигают модель и направление на карте (локальная
        симуляция).
      </p>
    </div>
  );
}
