import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export interface GatewayConfig {
  enabled: boolean;
  httpBaseUrl: string;
  postgresDsn: string;
  staleAfterSec: number;
  syncSecret: string;
}

export interface GatewayStatus {
  enabled: boolean;
  httpReachable?: boolean | null;
  postgresReachable?: boolean | null;
  pendingOutbox: number;
  lastSyncAt?: string | null;
  stale: boolean;
  message: string;
}

const previewCfg: GatewayConfig = {
  enabled: false,
  httpBaseUrl: "",
  postgresDsn: "",
  staleAfterSec: 120,
  syncSecret: "",
};

export async function getGatewayConfig(): Promise<GatewayConfig> {
  if (!isTauriRuntime()) return { ...previewCfg };
  return invoke("gateway_get_config");
}

export async function setGatewayConfig(
  config: GatewayConfig,
): Promise<GatewayConfig> {
  if (!isTauriRuntime()) return config;
  return invoke("gateway_set_config", { config });
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  if (!isTauriRuntime()) {
    return {
      enabled: false,
      pendingOutbox: 0,
      stale: false,
      message: "Gateway только в desktop",
    };
  }
  return invoke("gateway_status");
}

export async function enqueueGateway(
  kind: string,
  payload: unknown,
): Promise<string> {
  if (!isTauriRuntime()) return "preview";
  return invoke("gateway_enqueue", {
    kind,
    payload: JSON.stringify(payload),
  });
}

export async function tryGatewaySync(): Promise<GatewayStatus> {
  if (!isTauriRuntime()) throw new Error("только Tauri");
  return invoke("gateway_try_sync");
}
