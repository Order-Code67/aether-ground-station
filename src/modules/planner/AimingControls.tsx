import { useEffect, useState } from "react";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import {
  deleteAimingPreset,
  listAimingPresets,
  upsertAimingPreset,
  type AimingPreset,
} from "@/services/planner/aimingPresets";
import {
  createSerialPanTiltAdapter,
  getPanTiltAdapter,
  nullPanTiltAdapter,
  setPanTiltAdapter,
} from "@/services/pantilt/panTiltAdapter";
import {
  listSerialPorts,
  serialGetStatus,
  serialOpen,
} from "@/services/hardware";
import { isTauriRuntime } from "@/services/tauri";
import { eventBus } from "@/services/events/eventBus";
import type { SerialPortInfo } from "@/types";

/**
 * Manual station aiming — point, heading, range, patches, mast, servos.
 * COM: read-only angle stream. No servo write / remote actuator.
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
  const applyAimingPreset = useStationPlannerStore((s) => s.applyAimingPreset);
  const applyPatchesFromCatalog = useStationPlannerStore(
    (s) => s.applyPatchesFromCatalog,
  );
  const setPanTiltMode = useStationPlannerStore((s) => s.setPanTiltMode);
  const factAz = useStationPlannerStore((s) => s.factAzimuthDeg);
  const factEl = useStationPlannerStore((s) => s.factElevationDeg);
  const setFactAngles = useStationPlannerStore((s) => s.setFactAngles);

  const [presets, setPresets] = useState<AimingPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [comPath, setComPath] = useState("");
  const [comMsg, setComMsg] = useState<string | null>(null);
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);

  const mast = st?.mastHeightM ?? 15;

  useEffect(() => {
    void listAimingPresets().then(setPresets);
  }, []);

  // Poll fact angles when serial adapter is active.
  useEffect(() => {
    const id = window.setInterval(() => {
      void getPanTiltAdapter()
        .read()
        .then((s) => {
          setFactAngles(s.azimuthDeg, s.elevationDeg);
          if (s.message) setComMsg(s.message);
        });
    }, 1000);
    return () => window.clearInterval(id);
  }, [setFactAngles]);

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

  const savePreset = async () => {
    const name = presetName.trim() || `Наведение ${presets.length + 1}`;
    const next = await upsertAimingPreset({
      id: `aim_${Date.now().toString(36)}`,
      name,
      stationId: st.id,
      latitude: st.latitude,
      longitude: st.longitude,
      azimuthDeg: az,
      elevationDeg: el,
      rangeKm,
      videoPatchDeg,
      controlPatchDeg,
      mastHeightM: mast,
      updatedAt: new Date().toISOString(),
    });
    setPresets(next);
    setPresetName("");
    eventBus.emit("info", "planner", `Пресет сохранён: ${name}`);
  };

  const refreshPorts = async () => {
    if (!isTauriRuntime()) {
      setComMsg("COM только в desktop");
      return;
    }
    try {
      setPorts(await listSerialPorts());
      setComMsg(null);
    } catch (e) {
      setComMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const bindComRead = async () => {
    if (!comPath) {
      setComMsg("Выберите COM-порт");
      return;
    }
    try {
      const stCom = await serialGetStatus().catch(() => ({
        connected: false as boolean,
        path: undefined as string | undefined,
      }));
      if (!stCom.connected || stCom.path !== comPath) {
        await serialOpen(comPath, 115200);
      }
      setPanTiltAdapter(
        createSerialPanTiltAdapter({ deviceId: comPath, label: comPath }),
      );
      setPanTiltMode("monitoring");
      setComMsg(`Чтение углов с ${comPath} (только RX)`);
      eventBus.emit("info", "pantilt", `COM listen: ${comPath}`);
    } catch (e) {
      setComMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const unbindCom = () => {
    setPanTiltAdapter(nullPanTiltAdapter);
    setPanTiltMode("simulation");
    setFactAngles(null, null);
    setComMsg("Адаптер отключён");
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-xs"
      data-testid="aiming-controls"
    >
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
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={() =>
            void applyPatchesFromCatalog().then((msg) => {
              setCatalogMsg(msg);
              eventBus.emit("info", "planner", msg);
            })
          }
        >
          Патчи из каталога
        </button>
      </div>
      {catalogMsg && (
        <p className="text-[10px] text-ags-muted">{catalogMsg}</p>
      )}

      <div className="space-y-1 rounded border border-ags-border/60 p-2">
        <div className="text-[10px] font-semibold uppercase text-ags-muted">
          Пресеты наведения
        </div>
        <div className="flex gap-1">
          <input
            className="min-w-0 flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
            placeholder="Имя пресета"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-ags-border px-2 py-1"
            onClick={() => void savePreset()}
          >
            Сохранить
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="text-[10px] text-ags-dim">Нет сохранённых пресетов</p>
        ) : (
          <ul className="max-h-24 space-y-1 overflow-auto">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate rounded border border-ags-border px-2 py-0.5 text-left hover:bg-ags-elevated"
                  onClick={() => void applyAimingPreset(p)}
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-ags-danger"
                  aria-label={`Удалить ${p.name}`}
                  onClick={() =>
                    void deleteAimingPreset(p.id).then(setPresets)
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 rounded border border-ags-border/60 p-2">
        <div className="text-[10px] font-semibold uppercase text-ags-muted">
          COM углы (только чтение)
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded border border-ags-border px-2 py-1"
            onClick={() => void refreshPorts()}
          >
            Порты
          </button>
          <select
            className="min-w-0 flex-1 rounded border border-ags-border bg-ags-elevated px-1 py-1"
            value={comPath}
            onChange={(e) => setComPath(e.target.value)}
            aria-label="COM порт pan-tilt"
          >
            <option value="">—</option>
            {ports.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border border-ags-border px-2 py-1"
            onClick={() => void bindComRead()}
          >
            Слушать
          </button>
          <button
            type="button"
            className="rounded border border-ags-border px-2 py-1"
            onClick={unbindCom}
          >
            Стоп
          </button>
        </div>
        <p className="font-mono text-[10px] text-ags-dim">
          факт AZ {factAz == null ? "Н/Д" : `${factAz.toFixed(1)}°`} · EL{" "}
          {factEl == null ? "Н/Д" : `${factEl.toFixed(1)}°`}
        </p>
        {comMsg && <p className="text-[10px] text-ags-muted">{comMsg}</p>}
        <p className="text-[10px] text-ags-dim">
          Запись на серво / remote actuator — не реализована (нужен отдельный
          OK).
        </p>
      </div>

      <p className="text-[10px] leading-snug text-ags-dim">
        Патчи и коридор — геометрия на карте. Перепад высот по DEM; выше мачта —
        дальше просвет.
      </p>
    </div>
  );
}
