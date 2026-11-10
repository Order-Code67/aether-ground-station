//! Video Capture Service — FFmpeg/ffprobe detection and RTSP probe.
//! Full decode-to-WebView pipeline is staged; MediaDevices remains the live UVC path.

use serde::Serialize;
use std::process::Command;
use std::time::Duration;
use tauri::State;

use crate::auth_session::{self, AuthSessionState};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub available: bool,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub version: Option<String>,
    pub message: String,
}

fn which_tool(name: &str) -> Option<String> {
    #[cfg(windows)]
    let output = Command::new("where").arg(name).output().ok()?;
    #[cfg(not(windows))]
    let output = Command::new("which").arg(name).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().next().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn ffmpeg_version(path: &str) -> Option<String> {
    let output = Command::new(path).arg("-version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().next().map(|s| s.trim().to_string())
}

#[tauri::command]
pub fn video_ffmpeg_status() -> FfmpegStatus {
    let ffmpeg_path = which_tool("ffmpeg");
    let ffprobe_path = which_tool("ffprobe");
    let version = ffmpeg_path.as_deref().and_then(ffmpeg_version);
    let available = ffmpeg_path.is_some();
    let message = if available {
        "FFmpeg найден — RTSP probe доступен".into()
    } else {
        "FFmpeg не найден в PATH. Установите FFmpeg для RTSP/Video Capture Service.".into()
    };
    FfmpegStatus {
        available,
        ffmpeg_path,
        ffprobe_path,
        version,
        message,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RtspProbeResult {
    pub ok: bool,
    pub url: String,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
    pub streams: Vec<String>,
}

#[tauri::command]
pub fn video_probe_rtsp(
    auth: State<'_, AuthSessionState>,
    url: String,
) -> Result<RtspProbeResult, String> {
    auth_session::require_role_write(&auth)?;
    let url = url.trim().to_string();
    if url.is_empty() {
        return Err("Укажите RTSP URL".into());
    }
    if !(url.starts_with("rtsp://") || url.starts_with("rtsps://")) {
        return Err("URL должен начинаться с rtsp:// или rtsps://".into());
    }

    let status = video_ffmpeg_status();
    let Some(ffprobe) = status.ffprobe_path.or(status.ffmpeg_path) else {
        return Ok(RtspProbeResult {
            ok: false,
            url,
            latency_ms: None,
            error: Some(status.message),
            streams: vec![],
        });
    };

    let start = std::time::Instant::now();
    let mut cmd = Command::new(&ffprobe);
    // Prefer ffprobe args; if binary is ffmpeg, still attempt -i with timeout via Windows job is hard —
    // use short analyze duration.
    if ffprobe.ends_with("ffprobe") || ffprobe.ends_with("ffprobe.exe") {
        cmd.args([
            "-v",
            "error",
            "-rtsp_transport",
            "tcp",
            "-timeout",
            "3000000",
            "-show_entries",
            "stream=codec_type,codec_name",
            "-of",
            "csv=p=0",
            &url,
        ]);
    } else {
        cmd.args([
            "-hide_banner",
            "-rtsp_transport",
            "tcp",
            "-i",
            &url,
            "-t",
            "1",
            "-f",
            "null",
            "-",
        ]);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Не удалось запустить probe: {e}"))?;
    let latency_ms = Some(start.elapsed().as_millis() as u64);
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    if !output.status.success() {
        let err = if stderr.trim().is_empty() {
            "RTSP probe не удался (нет сигнала / недоступен хост)".to_string()
        } else {
            stderr.lines().take(4).collect::<Vec<_>>().join(" | ")
        };
        return Ok(RtspProbeResult {
            ok: false,
            url,
            latency_ms,
            error: Some(err),
            streams: vec![],
        });
    }

    let streams: Vec<String> = stdout
        .lines()
        .chain(stderr.lines())
        .filter(|l| l.contains("video") || l.contains("audio") || l.contains("Stream"))
        .map(|s| s.trim().to_string())
        .take(8)
        .collect();

    let _ = Duration::from_secs(0);
    Ok(RtspProbeResult {
        ok: true,
        url,
        latency_ms,
        error: None,
        streams,
    })
}
