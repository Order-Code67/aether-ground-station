import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import { useAuthStore } from "@/stores/authStore";

export interface Station {
  id: string;
  complexId?: string | null;
  siteId?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  terrainElevationM?: number | null;
  mastHeightM: number;
  antennaOffsetM: number;
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
  updatedAt: string;
}

/** Pure AMSL formula — unit-tested. */
export function calcAntennaCenterAmsl(
  terrainElevationM: number | null | undefined,
  mastHeightM: number,
  antennaOffsetM: number,
): number | null {
  if (terrainElevationM == null || Number.isNaN(terrainElevationM)) return null;
  return terrainElevationM + mastHeightM + antennaOffsetM;
}

const memory = new Map<string, Station>();

function actor(): string | undefined {
  return useAuthStore.getState().session?.user.username;
}

export async function listStations(): Promise<Station[]> {
  if (!isTauriRuntime()) return [...memory.values()];
  return invoke<Station[]>("station_list");
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
  return invoke<Station>("station_upsert", { actor: actor() ?? null, station: next });
}

export async function deleteStation(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    memory.delete(id);
    return;
  }
  await invoke("station_delete", { actor: actor() ?? null, id });
}
