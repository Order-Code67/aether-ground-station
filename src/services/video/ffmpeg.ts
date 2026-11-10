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
