import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";

export interface FfmpegStatus {
  available: boolean;
  ffmpegPath?: string | null;
  ffprobePath?: string | null;
  version?: string | null;
  message: string;
}

export interface RtspProbeResult {
  ok: boolean;
  url: string;
  latencyMs?: number | null;
  error?: string | null;
  streams: string[];
}

export interface RtspBridgeStatus {
  running: boolean;
  url?: string | null;
  framePath?: string | null;
  uptimeMs?: number | null;
  message: string;
}

export interface RtspBridgeFrame {
  ok: boolean;
  mime: string;
  base64?: string | null;
  sizeBytes?: number | null;
  error?: string | null;
}

export async function getFfmpegStatus(): Promise<FfmpegStatus> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      message: "FFmpeg probe доступен только в desktop-сборке",
    };
  }
  return invoke<FfmpegStatus>("video_ffmpeg_status");
}

export async function probeRtsp(url: string): Promise<RtspProbeResult> {
  if (!isTauriRuntime()) {
    throw new Error("RTSP probe только в Tauri");
  }
  return invoke<RtspProbeResult>("video_probe_rtsp", { url });
}

export async function startRtspBridge(url: string): Promise<RtspBridgeStatus> {
  if (!isTauriRuntime()) throw new Error("RTSP bridge только в Tauri");
  return invoke<RtspBridgeStatus>("video_rtsp_bridge_start", { url });
}

export async function stopRtspBridge(): Promise<RtspBridgeStatus> {
  if (!isTauriRuntime()) throw new Error("RTSP bridge только в Tauri");
  return invoke<RtspBridgeStatus>("video_rtsp_bridge_stop");
}

export async function getRtspBridgeStatus(): Promise<RtspBridgeStatus> {
  if (!isTauriRuntime()) {
    return { running: false, message: "preview" };
  }
  return invoke<RtspBridgeStatus>("video_rtsp_bridge_status");
}

export async function getRtspBridgeFrame(): Promise<RtspBridgeFrame> {
  if (!isTauriRuntime()) {
    return { ok: false, mime: "image/jpeg", error: "preview" };
  }
  return invoke<RtspBridgeFrame>("video_rtsp_bridge_frame");
}
