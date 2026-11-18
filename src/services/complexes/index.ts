import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export interface Complex {
  id: string;
  name: string;
  status: string;
  region?: string | null;
  payload: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  complexId?: string | null;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  address?: string | null;
  status: string;
  payload: string;
  createdAt?: string | null;
  updatedAt: string;
}

const memComplex = new Map<string, Complex>();
const memSite = new Map<string, Site>();

export async function listComplexes(): Promise<Complex[]> {
  if (!isTauriRuntime()) return [...memComplex.values()];
  return invoke("complex_list");
}

export async function upsertComplex(item: Complex): Promise<Complex> {
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (!isTauriRuntime()) {
    memComplex.set(next.id, next);
    return next;
  }
  return invoke("complex_upsert", { item: next });
}

export async function deleteComplex(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    memComplex.delete(id);
    return;
  }
  await invoke("complex_delete", { id });
}

export async function listSites(complexId?: string | null): Promise<Site[]> {
  if (!isTauriRuntime()) {
    const all = [...memSite.values()];
    return complexId ? all.filter((s) => s.complexId === complexId) : all;
  }
  return invoke("site_list", { complexId: complexId ?? null });
}

export async function upsertSite(item: Site): Promise<Site> {
  const next = { ...item, updatedAt: new Date().toISOString() };
  if (!isTauriRuntime()) {
    memSite.set(next.id, next);
    return next;
  }
  return invoke("site_upsert", { item: next });
}

export async function deleteSite(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    memSite.delete(id);
    return;
  }
  await invoke("site_delete", { id });
}
