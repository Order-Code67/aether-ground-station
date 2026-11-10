import { eventBus } from "./eventBus";

/** Typed domain events (ТЗ §35) — emit through Event Bus without coupling modules. */
export type DomainEventType =
  | "DeviceConnected"
  | "DeviceDisconnected"
  | "DeviceLost"
  | "VideoSignalDetected"
  | "VideoSignalLost"
  | "TelemetryUpdated"
  | "GatewayOffline"
  | "StationUpdated"
  | "TerrainDataLoaded"
  | "StorageWarning"
  | "MaintenanceDue"
  | "SystemError";

export function emitDomain(
  type: DomainEventType,
  source: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const severity =
    type === "SystemError" || type === "DeviceLost" || type === "GatewayOffline"
      ? "error"
      : type === "StorageWarning" || type === "MaintenanceDue" || type === "VideoSignalLost"
        ? "warning"
        : "info";
  eventBus.emit(severity, source, `[${type}] ${message}`, { type, ...details });
}
