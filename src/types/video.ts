/** ТЗ §6: нет устройства / нет сигнала / ок / потеря / запись / ошибка. */
export type VideoSignalState =
  | "unknown"
  | "no-device"
  | "no-signal"
  | "ok"
  | "degraded"
  | "lost"
  | "recording"
  | "error";

export interface CaptureDeviceInfo {
  deviceId: string;
  label: string;
}

export interface VideoMetrics {
  fps?: number;
  width?: number;
  height?: number;
  signal: VideoSignalState;
  error?: string;
}

export type WalksnailOutputMode = "hdmi-capture" | "usb-capture" | "unspecified";

export interface WalksnailDeviceSettings {
  displayName: string;
  outputMode: WalksnailOutputMode;
  captureDeviceId?: string;
  notes?: string;
}
