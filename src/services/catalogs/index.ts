import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export interface MastProfile {
  id: string;
  name: string;
  mastType: string;
  heightM: number;
  sections?: number | null;
  manufacturer?: string | null;
  model?: string | null;
  mountPointHeightM?: number | null;
  levels?: number | null;
  payload: string;
  updatedAt: string;
}

export interface AntennaProfile {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  antennaType?: string | null;
  frequencyRange?: string | null;
  polarization?: string | null;
  gainDbi?: number | null;
  beamwidthDeg?: number | null;
  connector?: string | null;
  massKg?: number | null;
  dimensions?: string | null;
  payload: string;
  updatedAt: string;
}

export interface AntennaMount {
  id: string;
  stationId: string;
  antennaProfileId?: string | null;
  label?: string | null;
  mountHeightM?: number | null;
  azimuthDeg?: number | null;
  elevationDeg?: number | null;
  tiltDeg?: number | null;
  azimuthSource?: string | null;
  payload: string;
  updatedAt: string;
}

export interface PlacementScenario {
  id: string;
  name: string;
  complexId?: string | null;
  payload: string;
  updatedAt: string;
}

const masts = new Map<string, MastProfile>();
const antennas = new Map<string, AntennaProfile>();
const mounts = new Map<string, AntennaMount>();
const scenarios = new Map<string, PlacementScenario>();

export async function listMastProfiles(): Promise<MastProfile[]> {
  if (!isTauriRuntime()) return [...masts.values()];
  return invoke("mast_profile_list");
}

export async function upsertMastProfile(item: MastProfile): Promise<MastProfile> {
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (!isTauriRuntime()) {
    masts.set(next.id, next);
    return next;
  }
  return invoke("mast_profile_upsert", { item: next });
}

export async function listAntennaProfiles(): Promise<AntennaProfile[]> {
  if (!isTauriRuntime()) return [...antennas.values()];
  return invoke("antenna_profile_list");
}

export async function upsertAntennaProfile(
  item: AntennaProfile,
): Promise<AntennaProfile> {
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (!isTauriRuntime()) {
    antennas.set(next.id, next);
    return next;
  }
  return invoke("antenna_profile_upsert", { item: next });
}

export async function listAntennaMounts(
  stationId?: string | null,
): Promise<AntennaMount[]> {
  if (!isTauriRuntime()) {
    const all = [...mounts.values()];
    return stationId ? all.filter((m) => m.stationId === stationId) : all;
  }
  return invoke("antenna_mount_list", { stationId: stationId ?? null });
}

export async function upsertAntennaMount(
  item: AntennaMount,
): Promise<AntennaMount> {
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (!isTauriRuntime()) {
    mounts.set(next.id, next);
    return next;
  }
  return invoke("antenna_mount_upsert", { item: next });
}

export async function deleteAntennaMount(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    mounts.delete(id);
    return;
  }
  await invoke("antenna_mount_delete", { id });
}

export async function listPlacementScenarios(): Promise<PlacementScenario[]> {
  if (!isTauriRuntime()) return [...scenarios.values()];
  return invoke("placement_scenario_list");
}

export async function upsertPlacementScenario(
  item: PlacementScenario,
): Promise<PlacementScenario> {
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (!isTauriRuntime()) {
    scenarios.set(next.id, next);
    return next;
  }
  return invoke("placement_scenario_upsert", { item: next });
}

/** Display helper — never invent RF numbers. */
export function na(v: string | number | null | undefined): string {
  if (v == null || v === "") return "N/A";
  return String(v);
}
