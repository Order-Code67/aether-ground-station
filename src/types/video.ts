/**
 * ТЗ §6 + P1-6 UI alignment:
 * connecting ≈ unknown/opening; streaming ≈ ok with frames;
 * no-device / no-signal / lost / recording / error — explicit.
 */
export type VideoSignalState =
  | "unknown"
  | "connecting"
  | "streaming"
  | "no-device"
  | "no-signal"
  | "ok"
  | "degraded"
  | "lost"
  | "recording"
  | "error";

/** Map internal/legacy states to operator-facing labels. */
export function videoSignalLabel(state: VideoSignalState): string {
  switch (state) {
    case "connecting":
    case "unknown":
      return "Connecting";
    case "streaming":
    case "ok":
      // Operator-facing Live only when frames are flowing (streaming/ok).
      return "Live";
    case "recording":
      return "Recording";
    case "no-device":
      return "No device";
    case "no-signal":
      return "No signal";
    case "lost":
      return "Lost";
    case "degraded":
      return "Degraded";
    case "error":
      return "Error";
    default:
      return state;
  }
}

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
