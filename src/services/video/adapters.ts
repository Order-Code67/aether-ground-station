import type { CaptureDeviceInfo } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { listCaptureDevices, openCaptureStream } from "./captureService";
import {
  getFfmpegStatus,
  probeRtsp,
  startRtspBridge,
  stopRtspBridge,
} from "./ffmpeg";

export type VideoAdapterKind = "mediadevices" | "rtsp" | "webrtc";

export interface VideoAdapter {
  kind: VideoAdapterKind;
  label: string;
  listSources(): Promise<CaptureDeviceInfo[]>;
  open(sourceId: string): Promise<MediaStream | RtspBridgeHandle>;
}

/** Opaque handle for JPEG bridge (not a MediaStream). */
export interface RtspBridgeHandle {
  kind: "rtsp-bridge";
  url: string;
  stop: () => Promise<void>;
}

export function isRtspBridgeHandle(
  v: MediaStream | RtspBridgeHandle,
): v is RtspBridgeHandle {
  return (
    typeof v === "object" &&
    v !== null &&
    "kind" in v &&
    (v as RtspBridgeHandle).kind === "rtsp-bridge"
  );
}

export const mediaDevicesAdapter: VideoAdapter = {
  kind: "mediadevices",
  label: "UVC / HDMI (MediaDevices)",
  listSources: listCaptureDevices,
  open: (id) => openCaptureStream(id || undefined),
};

/**
 * RTSP via FFmpeg JPEG bridge (real decode). Requires FFmpeg in PATH + reachable URL.
 */
export const rtspAdapter: VideoAdapter = {
  kind: "rtsp",
  label: "RTSP (FFmpeg bridge)",
  async listSources() {
    return [];
  },
  async open(url: string) {
    if (!url.trim()) throw new Error("Укажите RTSP URL");
    const status = await getFfmpegStatus();
    if (!status.available) {
      eventBus.emit("warning", "video-rtsp", status.message);
      throw new Error(status.message);
    }
    const probe = await probeRtsp(url.trim());
    if (!probe.ok) {
      const msg = probe.error ?? "Нет сигнала / RTSP недоступен";
      eventBus.emit("error", "video-rtsp", msg);
      throw new Error(msg);
    }
    await startRtspBridge(url.trim());
    eventBus.emit(
      "info",
      "video-rtsp",
      `RTSP bridge OK (${probe.latencyMs ?? "?"} мс probe)`,
    );
    return {
      kind: "rtsp-bridge" as const,
      url: url.trim(),
      stop: async () => {
        await stopRtspBridge();
      },
    };
  },
};

export const webrtcAdapter: VideoAdapter = {
  kind: "webrtc",
  label: "WebRTC",
  async listSources() {
    return [];
  },
  async open(signalingUrl: string) {
    if (!signalingUrl.trim()) throw new Error("Укажите signaling URL");
    eventBus.emit(
      "warning",
      "video-webrtc",
      "WebRTC-адаптер ожидает signaling endpoint Remote/Video Relay.",
    );
    throw new Error(
      "WebRTC: нет signaling endpoint. Настройте Remote Gateway или локальный relay.",
    );
  },
};

export function getVideoAdapter(kind: VideoAdapterKind): VideoAdapter {
  switch (kind) {
    case "rtsp":
      return rtspAdapter;
    case "webrtc":
      return webrtcAdapter;
    default:
      return mediaDevicesAdapter;
  }
}
