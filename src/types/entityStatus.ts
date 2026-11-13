import type { DeviceStatus } from "./devices";
import type { VideoSignalState } from "./video";

/** Unified entity status vocabulary (GS-1). */
export type EntityStatusId =
  | "online"
  | "offline"
  | "lost"
  | "connecting"
  | "reconnecting"
  | "error"
  | "no_device"
  | "no_signal"
  | "not_configured"
  | "not_available";

export type EntityStatusTone = "neutral" | "ok" | "warn" | "danger";

export interface EntityStatusView {
  id: EntityStatusId;
  /** Stable English id for logs / tests */
  labelEn: string;
  /** Operator-facing Russian */
  labelRu: string;
  tone: EntityStatusTone;
}

const TABLE: Record<EntityStatusId, EntityStatusView> = {
  online: {
    id: "online",
    labelEn: "Online",
    labelRu: "На связи",
    tone: "ok",
  },
  offline: {
    id: "offline",
    labelEn: "Offline",
    labelRu: "Отключено",
    tone: "neutral",
  },
  lost: {
    id: "lost",
    labelEn: "Lost",
    labelRu: "Потеряно",
    tone: "warn",
  },
  connecting: {
    id: "connecting",
    labelEn: "Connecting",
    labelRu: "Подключение",
    tone: "warn",
  },
  reconnecting: {
    id: "reconnecting",
    labelEn: "Reconnecting",
    labelRu: "Переподключение",
    tone: "warn",
  },
  error: {
    id: "error",
    labelEn: "Error",
    labelRu: "Ошибка",
    tone: "danger",
  },
  no_device: {
    id: "no_device",
    labelEn: "No Device",
    labelRu: "Нет устройства",
    tone: "warn",
  },
  no_signal: {
    id: "no_signal",
    labelEn: "No Signal",
    labelRu: "Нет сигнала",
    tone: "warn",
  },
  not_configured: {
    id: "not_configured",
    labelEn: "Not Configured",
    labelRu: "Не настроено",
    tone: "neutral",
  },
  not_available: {
    id: "not_available",
    labelEn: "Not Available",
    labelRu: "Недоступно",
    tone: "neutral",
  },
};

export function entityStatus(id: EntityStatusId): EntityStatusView {
  return TABLE[id];
}

export function deviceToEntityStatus(status: DeviceStatus): EntityStatusId {
  switch (status) {
    case "Online":
      return "online";
    case "Offline":
      return "offline";
    case "Lost":
      return "lost";
    case "Connecting":
      return "connecting";
    case "Reconnecting":
      return "reconnecting";
    case "Error":
      return "error";
    case "Warning":
      return "lost";
    case "Unknown":
    default:
      return "not_available";
  }
}

export function videoToEntityStatus(state: VideoSignalState): EntityStatusId {
  switch (state) {
    case "streaming":
    case "ok":
    case "recording":
      return "online";
    case "connecting":
    case "unknown":
      return "connecting";
    case "no-device":
      return "no_device";
    case "no-signal":
      return "no_signal";
    case "lost":
    case "degraded":
      return "lost";
    case "error":
      return "error";
    default:
      return "not_available";
  }
}
