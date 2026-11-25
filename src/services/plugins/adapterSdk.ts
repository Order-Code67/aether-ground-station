/**
 * Adapter SDK — register extra telemetry/video adapters from a plugin manifest.
 * Plugins cannot invent sensor values; they only parse real frames.
 */
import { pluginManager, type PluginManifest } from "./pluginManager";
import {
  registerTelemetryAdapter,
  type TelemetryAdapter,
} from "@/services/telemetry/normalize";

export const DENIED_PERMISSIONS = ["*", "system.exec", "shell.exec"] as const;

export function assertSafePermissions(permissions: string[]): void {
  for (const p of permissions) {
    if (
      DENIED_PERMISSIONS.includes(p as (typeof DENIED_PERMISSIONS)[number]) ||
      p === "all"
    ) {
      throw new Error(`Небезопасные permissions отклонены: ${p}`);
    }
  }
}

export function registerPluginTelemetryAdapter(
  manifest: PluginManifest,
  adapter: TelemetryAdapter,
): void {
  assertSafePermissions(manifest.permissions);
  if (!manifest.permissions.includes("telemetry.parse")) {
    throw new Error("Нужно permission telemetry.parse");
  }
  if (!pluginManager.isEnabled(manifest.id)) {
    throw new Error(`Плагин ${manifest.id} выключен`);
  }
  registerTelemetryAdapter(adapter);
}
