import { useEffect, useState } from "react";
import {
  listAntennaMounts,
  listAntennaProfiles,
  listMastProfiles,
  na,
  upsertAntennaMount,
  upsertAntennaProfile,
  upsertMastProfile,
  type AntennaMount,
  type AntennaProfile,
  type MastProfile,
} from "@/services/catalogs";
import { listStations, type Station } from "@/services/stations";
import { useAuthStore } from "@/stores/authStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";

function nid(p: string) {
  return `${p}_${Date.now().toString(36)}`;
}

const MAST_TYPES = [
  "stationary",
  "telescopic",
  "sectional",
  "mobile",
  "rooftop",
  "tripod",
  "custom",
] as const;

export function MastAntennaPanel() {
  const can = useAuthStore((s) => s.can("manageDevices"));
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const [masts, setMasts] = useState<MastProfile[]>([]);
  const [antennas, setAntennas] = useState<AntennaProfile[]>([]);
  const [mounts, setMounts] = useState<AntennaMount[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const refresh = async () => {
    setMasts(await listMastProfiles());
    setAntennas(await listAntennaProfiles());
    setStations(await listStations());
    setMounts(await listAntennaMounts(activeStationId));
  };

  useEffect(() => {
    void refresh().catch((e) =>
      setNote(e instanceof Error ? e.message : String(e)),
    );
  }, [activeStationId]);

  const stationId = activeStationId ?? stations[0]?.id;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 text-sm">
      <p className="text-xs text-ags-muted">
        Каталог мачт и антенн. Неизвестные RF-параметры — N/A, без выдуманных
        значений.
      </p>
      {note && <p className="text-ags-danger">{note}</p>}

      <section className="space-y-2 rounded border border-ags-border bg-ags-panel p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase text-ags-dim">Мачты</h2>
          <button
            type="button"
            disabled={!can}
            className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
            onClick={() =>
              void upsertMastProfile({
                id: nid("mast"),
                name: `Мачта ${masts.length + 1}`,
                mastType: "telescopic",
                heightM: 12,
                payload: "{}",
                updatedAt: new Date().toISOString(),
              }).then(refresh)
            }
          >
            + мачта
          </button>
        </div>
        <ul className="space-y-1 text-xs">
          {masts.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-2 rounded border border-ags-border px-2 py-1"
            >
              <span className="font-medium">{m.name}</span>
              <select
                className="rounded border border-ags-border bg-ags-elevated px-1"
                disabled={!can}
                value={m.mastType}
                onChange={(e) =>
                  void upsertMastProfile({
                    ...m,
                    mastType: e.target.value,
                  }).then(refresh)
                }
              >
                {MAST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="font-mono">{m.heightM} м</span>
              <span className="text-ags-dim">
                крепление {na(m.mountPointHeightM)} м · уровни {na(m.levels)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded border border-ags-border bg-ags-panel p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase text-ags-dim">
            Антенны
          </h2>
          <button
            type="button"
            disabled={!can}
            className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
            onClick={() =>
              void upsertAntennaProfile({
                id: nid("ant"),
                name: `Антенна ${antennas.length + 1}`,
                antennaType: "directional",
                payload: "{}",
                updatedAt: new Date().toISOString(),
              }).then(refresh)
            }
          >
            + антенна
          </button>
        </div>
        <ul className="space-y-2 text-xs">
          {antennas.map((a) => (
            <li
              key={a.id}
              className="rounded border border-ags-border px-2 py-2"
            >
              <div className="font-medium">{a.name}</div>
              <div className="text-ags-dim">
                {na(a.manufacturer)} · {na(a.model)} · {na(a.antennaType)}
              </div>
              <div className="mt-1 font-mono text-ags-muted">
                gain {na(a.gainDbi)} dBi · HPBW {na(a.beamwidthDeg)}° ·{" "}
                {na(a.frequencyRange)} · pol {na(a.polarization)}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded border border-ags-border bg-ags-panel p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase text-ags-dim">
            Крепления на станции
          </h2>
          <button
            type="button"
            disabled={!can || !stationId}
            className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
            onClick={() =>
              void upsertAntennaMount({
                id: nid("mnt"),
                stationId: stationId!,
                antennaProfileId: antennas[0]?.id ?? null,
                label: `Mount ${mounts.length + 1}`,
                azimuthDeg: null,
                mountHeightM: null,
                azimuthSource: "manual",
                payload: "{}",
                updatedAt: new Date().toISOString(),
              }).then(refresh)
            }
          >
            + mount
          </button>
        </div>
        {!stationId && (
          <p className="text-xs text-ags-dim">Выберите станцию в Complex Manager</p>
        )}
        <ul className="space-y-1 text-xs">
          {mounts.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap gap-2 rounded border border-ags-border px-2 py-1"
            >
              <span>{m.label ?? m.id}</span>
              <span className="font-mono">
                az {na(m.azimuthDeg)}° · h {na(m.mountHeightM)} м
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
