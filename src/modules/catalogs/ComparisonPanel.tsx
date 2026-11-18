import { useEffect, useState } from "react";
import {
  listPlacementScenarios,
  upsertPlacementScenario,
  type PlacementScenario,
} from "@/services/catalogs";
import { listStations, type Station } from "@/services/stations";
import { useAuthStore } from "@/stores/authStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";

/** GS-9 station comparison A/B/C scenarios. */
export function ComparisonPanel() {
  const can = useAuthStore((s) => s.can("manageDevices"));
  const complexId = useStationPlannerStore((s) => s.activeComplexId);
  const [stations, setStations] = useState<Station[]>([]);
  const [scenarios, setScenarios] = useState<PlacementScenario[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    void listStations({ complexId }).then(setStations);
    void listPlacementScenarios().then(setScenarios);
  }, [complexId]);

  const selected = stations.filter((s) => picked.includes(s.id));

  const toggle = (id: string) => {
    setPicked((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 3
          ? prev
          : [...prev, id],
    );
  };

  const saveScenario = async () => {
    if (!can || selected.length < 2) return;
    await upsertPlacementScenario({
      id: `scn_${Date.now().toString(36)}`,
      name: `Сценарий ${["A", "B", "C"].slice(0, selected.length).join("/")}`,
      complexId,
      payload: JSON.stringify({
        stationIds: selected.map((s) => s.id),
        snapshot: selected.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.latitude,
          lng: s.longitude,
          terrain: s.terrainElevationM,
          mast: s.mastHeightM,
          amsl: s.antennaCenterAmslM,
        })),
      }),
      updatedAt: new Date().toISOString(),
    });
    setScenarios(await listPlacementScenarios());
  };

  return (
    <div className="space-y-3 border-t border-ags-border p-4 text-sm">
      <h2 className="text-xs font-semibold uppercase text-ags-dim">
        Сравнение станций A/B/C
      </h2>
      <div className="flex flex-wrap gap-2">
        {stations.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`rounded border px-2 py-1 text-xs ${
              picked.includes(s.id)
                ? "border-ags-accent bg-ags-elevated"
                : "border-ags-border"
            }`}
            onClick={() => toggle(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-ags-dim">
              <th className="p-1">Станция</th>
              <th className="p-1">Coords</th>
              <th className="p-1">Terrain</th>
              <th className="p-1">Mast</th>
              <th className="p-1">AMSL ant</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((s) => (
              <tr key={s.id} className="border-t border-ags-border">
                <td className="p-1">{s.name}</td>
                <td className="p-1 font-mono">
                  {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                </td>
                <td className="p-1 font-mono">
                  {s.terrainElevationM == null ? "N/A" : s.terrainElevationM}
                </td>
                <td className="p-1 font-mono">
                  {s.mastHeightM == null ? "N/A" : s.mastHeightM}
                </td>
                <td className="p-1 font-mono">
                  {s.antennaCenterAmslM == null
                    ? "N/A"
                    : s.antennaCenterAmslM.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        type="button"
        disabled={!can || selected.length < 2}
        className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
        onClick={() => void saveScenario()}
      >
        Сохранить сценарий
      </button>
      <ul className="text-[11px] text-ags-dim">
        {scenarios.map((s) => (
          <li key={s.id}>
            {s.name} · {s.updatedAt}
          </li>
        ))}
      </ul>
    </div>
  );
}
