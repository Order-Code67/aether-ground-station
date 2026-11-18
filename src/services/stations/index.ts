import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import { useAuthStore } from "@/stores/authStore";

export interface Station {
  id: string;
  complexId?: string | null;
  siteId?: string | null;
  name: string;
  description?: string | null;
  status?: string | null;
  latitude: number;
  longitude: number;
  terrainElevationM?: number | null;
  /** null = unknown — do not treat as 0 for AMSL */
  mastHeightM?: number | null;
  antennaOffsetM?: number | null;
  antennaCenterAmslM?: number | null;
  mastType?: string | null;
  antennaType?: string | null;
  equipmentModel?: string | null;
  azimuthDeg?: number | null;
  azimuthRef?: string | null;
  elevationDeg?: number | null;
  tiltDeg?: number | null;
  panTiltStatus?: string | null;
  equipmentStatus?: string | null;
  notes?: string | null;
  payload: string;
  createdAt?: string | null;
  updatedAt: string;
}

/** Pure AMSL — requires terrain + mast; offset defaults to 0. */
export function calcAntennaCenterAmsl(
  terrainElevationM: number | null | undefined,
  mastHeightM: number | null | undefined,
  antennaOffsetM: number | null | undefined,
): number | null {
  if (terrainElevationM == null || Number.isNaN(terrainElevationM)) return null;
  if (mastHeightM == null || Number.isNaN(mastHeightM)) return null;
  const offset =
    antennaOffsetM == null || Number.isNaN(antennaOffsetM) ? 0 : antennaOffsetM;
  return terrainElevationM + mastHeightM + offset;
}

const memory = new Map<string, Station>();

function actor(): string | undefined {
  return useAuthStore.getState().session?.user.username;
}

export async function listStations(opts?: {
  complexId?: string | null;
  siteId?: string | null;
}): Promise<Station[]> {
  if (!isTauriRuntime()) {
    let all = [...memory.values()];
    if (opts?.complexId) {
      all = all.filter((s) => s.complexId === opts.complexId);
    }
    if (opts?.siteId) {
      all = all.filter((s) => s.siteId === opts.siteId);
    }
    return all;
  }
  return invoke<Station[]>("station_list", {
    complexId: opts?.complexId ?? null,
    siteId: opts?.siteId ?? null,
  });
}

export async function upsertStation(station: Station): Promise<Station> {
  const amsl = calcAntennaCenterAmsl(
    station.terrainElevationM,
    station.mastHeightM,
    station.antennaOffsetM,
  );
  const next = {
    ...station,
    antennaCenterAmslM: amsl,
    updatedAt: new Date().toISOString(),
  };
  if (!isTauriRuntime()) {
    memory.set(next.id, next);
    return next;
  }
  return invoke<Station>("station_upsert", {
    actor: actor() ?? null,
    station: next,
  });
}

export async function deleteStation(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    memory.delete(id);
    return;
  }
  await invoke("station_delete", { actor: actor() ?? null, id });
}
