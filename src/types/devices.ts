export type DeviceStatus =
  | "Online"
  | "Offline"
  | "Lost"
  | "Connecting"
  | "Reconnecting"
  | "Warning"
  | "Error"
  | "Unknown";

export type ConnectionType = "ethernet" | "usb" | "wifi" | "uart" | "capture";

export interface DeviceConnectionEvent {
  at: string;
  kind: "online" | "offline" | "error" | "reconnect" | "lost" | "info";
  message: string;
}

export interface DeviceCard {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  connectionType: ConnectionType;
  address?: string;
  status: DeviceStatus;
  lastSeenAt?: string;
  lastError?: string | null;
  /** Recent connection timeline (newest first, capped). */
  history?: DeviceConnectionEvent[];
  firmwareVersion?: string;
  capabilities: string[];
}
