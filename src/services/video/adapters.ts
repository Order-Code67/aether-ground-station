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
  label: "WebRTC (signaling)",
  async listSources() {
    return [];
  },
  async open(signalingUrl: string): Promise<MediaStream> {
    const url = signalingUrl.trim() || "ws://127.0.0.1:8790/?room=ags";
    if (!(url.startsWith("ws://") || url.startsWith("wss://"))) {
      throw new Error("Signaling URL: ws:// или wss://");
    }
    await new Promise<void>((_resolve, reject) => {
      const ws = new WebSocket(url);
      const t = window.setTimeout(() => {
        ws.close();
        reject(new Error("WebRTC signaling timeout — запустите npm run webrtc:relay"));
      }, 4000);
      ws.onopen = () => {
        window.clearTimeout(t);
        ws.send(JSON.stringify({ type: "hello", from: "ags-desktop" }));
        ws.close();
        eventBus.emit(
          "info",
          "video-webrtc",
          `Signaling OK (${url}). Media SFU — отдельный этап; кадры через RTSP bridge или UVC.`,
        );
        reject(
          new Error(
            "Signaling доступен, но MediaStream bridge ещё не подключён. Используйте RTSP/UVC для просмотра.",
          ),
        );
      };
      ws.onerror = () => {
        window.clearTimeout(t);
        reject(
          new Error(
            "WebRTC signaling недоступен. npm run webrtc:relay → ws://127.0.0.1:8790",
          ),
        );
      };
    });
    throw new Error("unreachable");
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
