import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export interface EquipmentItem {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  inventoryNumber?: string | null;
  status?: string | null;
  location?: string | null;
  payload: string;
  updatedAt: string;
}

export interface MaintenanceItem {
  id: string;
  equipmentId?: string | null;
  dueAt?: string | null;
  status?: string | null;
  notes?: string | null;
  payload: string;
  updatedAt: string;
}

const memEq = new Map<string, EquipmentItem>();
const memMt = new Map<string, MaintenanceItem>();

export async function listEquipment(): Promise<EquipmentItem[]> {
  if (!isTauriRuntime()) return [...memEq.values()];
  return invoke("inventory_list");
}

export async function upsertEquipment(item: EquipmentItem): Promise<EquipmentItem> {
  if (!isTauriRuntime()) {
    memEq.set(item.id, item);
    return item;
  }
  return invoke("inventory_upsert", { item });
}

export async function listMaintenance(): Promise<MaintenanceItem[]> {
  if (!isTauriRuntime()) return [...memMt.values()];
  return invoke("maintenance_list");
}

export async function upsertMaintenance(item: MaintenanceItem): Promise<MaintenanceItem> {
  if (!isTauriRuntime()) {
    memMt.set(item.id, item);
    return item;
  }
  return invoke("maintenance_upsert", { item });
}

export async function fetchComplexReportJson(): Promise<string> {
  if (!isTauriRuntime()) {
    return JSON.stringify(
      { stations: 0, devices: 0, equipment: memEq.size, note: "preview" },
      null,
      2,
    );
  }
  return invoke("report_complex_summary");
}

export async function exportComplexReportPdf(): Promise<{
  path: string;
  bytes: number;
  message: string;
}> {
  if (!isTauriRuntime()) {
    throw new Error("PDF только в desktop");
  }
  return invoke("report_complex_pdf");
}

export async function appendTelemetryRecord(payload: {
  id: string;
  deviceId?: string;
  at: string;
  payload: string;
}): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("telemetry_append", payload);
}

export async function listTelemetryRecords(
  limit = 200,
): Promise<
  Array<{ id: string; deviceId?: string | null; at: string; payload: string }>
> {
  if (!isTauriRuntime()) return [];
  return invoke("telemetry_list", { limit });
}
