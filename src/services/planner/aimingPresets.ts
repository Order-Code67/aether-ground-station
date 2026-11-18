import { dbGetJson, dbUpsertJson } from "@/services/database";

const KEY = "aiming_presets";

export interface AimingPreset {
  id: string;
  name: string;
  stationId?: string | null;
  latitude: number;
  longitude: number;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  videoPatchDeg: number;
  controlPatchDeg: number;
  mastHeightM: number;
  updatedAt: string;
}

export async function listAimingPresets(): Promise<AimingPreset[]> {
  const list = await dbGetJson<AimingPreset[]>(KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function upsertAimingPreset(
  preset: AimingPreset,
): Promise<AimingPreset[]> {
  const cur = await listAimingPresets();
  const next = {
    ...preset,
    updatedAt: new Date().toISOString(),
  };
  const idx = cur.findIndex((p) => p.id === next.id);
  if (idx >= 0) cur[idx] = next;
  else cur.push(next);
  await dbUpsertJson(KEY, cur);
  return cur;
}

export async function deleteAimingPreset(id: string): Promise<AimingPreset[]> {
  const cur = (await listAimingPresets()).filter((p) => p.id !== id);
  await dbUpsertJson(KEY, cur);
  return cur;
}
