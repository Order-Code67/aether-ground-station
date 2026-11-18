import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export interface DiskSpaceInfo {
  path: string;
  totalBytes: number;
  availableBytes: number;
}

export async function getDiskSpace(
  path?: string,
): Promise<DiskSpaceInfo | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<DiskSpaceInfo>("system_disk_space", {
      path: path ?? null,
    });
  } catch {
    return null;
  }
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "N/A";
  const gb = n / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} ГБ`;
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(0)} МБ`;
}
