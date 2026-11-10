import type { CaptureDeviceInfo } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { listCaptureDevices, openCaptureStream } from "./captureService";
import { getFfmpegStatus, probeRtsp } from "./ffmpeg";

export type VideoAdapterKind = "mediadevices" | "rtsp" | "webrtc";

export interface VideoAdapter {
  kind: VideoAdapterKind;
  label: string;
  listSources(): Promise<CaptureDeviceInfo[]>;
  open(sourceId: string): Promise<MediaStream>;
}

export const mediaDevicesAdapter: VideoAdapter = {
  kind: "mediadevices",
  label: "UVC / HDMI (MediaDevices)",
  listSources: listCaptureDevices,
  open: (id) => openCaptureStream(id || undefined),
};

/**
 * RTSP: probe via FFmpeg/ffprobe (Video Capture Service).
 * Decode→MediaStream in WebView still requires native frame bridge — probe validates source.
 */
export const rtspAdapter: VideoAdapter = {
  kind: "rtsp",
  label: "RTSP (FFmpeg probe)",
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
    eventBus.emit(
      "info",
      "video-rtsp",
      `RTSP OK (${probe.latencyMs ?? "?"} мс). Декод в WebView — следующий этап Video Capture Service.`,
    );
    throw new Error(
      "RTSP источник доступен (probe OK), но кадры в UI ещё требуют native decode bridge. Используйте UVC/HDMI для просмотра.",
    );
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
