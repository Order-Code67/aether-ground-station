import { useState } from "react";
import { parseLatLonInput } from "@/services/planner/parseCoords";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { eventBus } from "@/services/events/eventBus";

/** Explicit lat/lon placement for НСУ and planning markers. */
export function CoordinatePlaceForm({ compact = false }: { compact?: boolean }) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const placeOrMoveNsu = useStationPlannerStore((s) => s.placeOrMoveNsu);
  const addMapMarker = useStationPlannerStore((s) => s.addMapMarker);
  const placeLookAt = useStationPlannerStore((s) => s.placeLookAt);

  const parsed = () => {
    const r = parseLatLonInput(lat, lng);
    if (!r.ok) {
      setErr(r.error);
      eventBus.emit("error", "planner", r.error);
      return null;
    }
    setErr(null);
    return r;
  };

  const placeNsu = async () => {
    const r = parsed();
    if (!r) return;
    setBusy(true);
    try {
      const st = await placeOrMoveNsu(r.lat, r.lng);
      const h =
        st.terrainElevationM == null
          ? "рельеф Н/Д"
          : `H ${st.terrainElevationM.toFixed(1)} м`;
      eventBus.emit(
        "info",
        "planner",
        `НСУ: ${st.latitude.toFixed(5)}, ${st.longitude.toFixed(5)} · ${h}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось поставить НСУ";
      setErr(msg);
      eventBus.emit("error", "planner", msg);
    } finally {
      setBusy(false);
    }
  };

  const placeB = () => {
    const r = parsed();
    if (!r) return;
    try {
      const b = placeLookAt(r.lat, r.lng);
      eventBus.emit(
        "info",
        "planner",
        `Цель B: ${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось поставить цель B";
      setErr(msg);
      eventBus.emit("error", "planner", msg);
    }
  };

  const placePoint = async () => {
    const r = parsed();
    if (!r) return;
    setBusy(true);
    try {
      await addMapMarker(r.lat, r.lng, label.trim() || undefined);
      eventBus.emit(
        "info",
        "planner",
        `Точка: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`,
      );
      setLabel("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось поставить точку";
      setErr(msg);
      eventBus.emit("error", "planner", msg);
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "min-w-0 flex-1 rounded border border-ags-border bg-ags-elevated px-1.5 py-0.5 font-mono text-[11px]";

  return (
    <div
      className={compact ? "flex flex-wrap items-end gap-1" : "space-y-1.5"}
      data-testid="coord-place-form"
    >
      {!compact && (
        <div className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          По координатам
        </div>
      )}
      <div className="flex min-w-0 flex-wrap gap-1">
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="Широта"
          aria-label="Широта"
          value={lat}
          onChange={(e) => {
            setLat(e.target.value);
            setErr(null);
          }}
        />
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder="Долгота"
          aria-label="Долгота"
          value={lng}
          onChange={(e) => {
            setLng(e.target.value);
            setErr(null);
          }}
        />
        {!compact && (
          <input
            className={fieldClass}
            placeholder="Метка точки (необяз.)"
            aria-label="Метка точки"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy}
          className="rounded bg-ags-accent px-2 py-0.5 text-[10px] text-white disabled:opacity-40"
          onClick={() => void placeNsu()}
        >
          НСУ по координатам
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-ags-border px-2 py-0.5 text-[10px] disabled:opacity-40"
          onClick={() => placeB()}
        >
          Цель B по координатам
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-ags-border px-2 py-0.5 text-[10px] disabled:opacity-40"
          onClick={() => void placePoint()}
        >
          Точка по координатам
        </button>
      </div>
      {err && (
        <p className="text-[10px] text-ags-danger" role="alert">
          {err}
        </p>
      )}
      {!compact && (
        <p className="text-[9px] text-ags-dim">
          Пустые/мусор и GPS 0,0 — ошибка, не начало координат. Высота — из DEM,
          иначе Н/Д.
        </p>
      )}
    </div>
  );
}
