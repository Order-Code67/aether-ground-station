//! Video Capture Service — FFmpeg detection, RTSP probe, JPEG frame bridge.
//! Bridge: ffmpeg writes updating JPEG; UI polls base64 frames (no mock video).

use serde::Serialize;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State};

use crate::auth_session::{self, AuthSessionState};

#[derive(Default)]
pub struct RtspBridgeState {
    inner: Mutex<Option<BridgeRuntime>>,
}

struct BridgeRuntime {
    child: Child,
    url: String,
    frame_path: PathBuf,
    started_at: Instant,
}

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
    text.lines()
        .next()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn bundled_tool(app: &AppHandle, exe: &str) -> Option<String> {
    let resource = app.path().resource_dir().ok()?;
    #[cfg(windows)]
    let name = format!("{exe}.exe");
    #[cfg(not(windows))]
    let name = exe.to_string();
    let candidates = [
        resource.join("bin").join(&name),
        resource.join(&name),
        resource.join("resources").join("bin").join(&name),
    ];
    for p in candidates {
        if p.is_file() {
            return Some(p.to_string_lossy().into());
        }
    }
    None
}

fn resolve_tool(app: Option<&AppHandle>, name: &str) -> Option<String> {
    if let Some(app) = app {
        if let Some(p) = bundled_tool(app, name) {
            return Some(p);
        }
    }
    which_tool(name)
}

fn ffmpeg_version(path: &str) -> Option<String> {
    let output = Command::new(path).arg("-version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().next().map(|s| s.trim().to_string())
}

fn status_with_app(app: Option<&AppHandle>) -> FfmpegStatus {
    let ffmpeg_path = resolve_tool(app, "ffmpeg");
    let ffprobe_path = resolve_tool(app, "ffprobe");
    let version = ffmpeg_path.as_deref().and_then(ffmpeg_version);
    let available = ffmpeg_path.is_some();
    let bundled = app
        .and_then(|a| bundled_tool(a, "ffmpeg"))
        .is_some();
    let message = if available && bundled {
        "FFmpeg bundled — RTSP probe и JPEG bridge доступны".into()
    } else if available {
        "FFmpeg из PATH — RTSP probe и JPEG bridge доступны".into()
    } else {
        "FFmpeg не найден. Запустите scripts/fetch-ffmpeg.ps1 или установите в PATH.".into()
    };
    FfmpegStatus {
        available,
        ffmpeg_path,
        ffprobe_path,
        version,
        message,
    }
}

#[tauri::command]
pub fn video_ffmpeg_status(app: AppHandle) -> FfmpegStatus {
    status_with_app(Some(&app))
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
    app: AppHandle,
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

    let status = status_with_app(Some(&app));
    let Some(ffprobe) = status.ffprobe_path.or(status.ffmpeg_path) else {
        return Ok(RtspProbeResult {
            ok: false,
            url,
            latency_ms: None,
            error: Some(status.message),
            streams: vec![],
        });
    };

    let start = Instant::now();
    let mut cmd = Command::new(&ffprobe);
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RtspBridgeStatus {
    pub running: bool,
    pub url: Option<String>,
    pub frame_path: Option<String>,
    pub uptime_ms: Option<u64>,
    pub message: String,
}

fn stop_bridge_locked(slot: &mut Option<BridgeRuntime>) {
    if let Some(mut rt) = slot.take() {
        let _ = rt.child.kill();
        let _ = rt.child.wait();
        let _ = std::fs::remove_file(&rt.frame_path);
    }
}

#[tauri::command]
pub fn video_rtsp_bridge_start(
    app: AppHandle,
    auth: State<'_, AuthSessionState>,
    bridge: State<'_, RtspBridgeState>,
    url: String,
) -> Result<RtspBridgeStatus, String> {
    auth_session::require_role_write(&auth)?;
    let url = url.trim().to_string();
    if !(url.starts_with("rtsp://") || url.starts_with("rtsps://")) {
        return Err("URL должен начинаться с rtsp:// или rtsps://".into());
    }
    let status = status_with_app(Some(&app));
    let Some(ffmpeg) = status.ffmpeg_path else {
        return Err(status.message);
    };

    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("rtsp_bridge");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let frame_path = dir.join("live.jpg");
    let frame_str = frame_path
        .to_str()
        .ok_or_else(|| "Некорректный путь кадра".to_string())?
        .to_string();

    let mut guard = bridge.inner.lock().map_err(|e| e.to_string())?;
    stop_bridge_locked(&mut guard);

    // Continuously overwrite a single JPEG (~5–10 fps). Real decode path; no synthetic frames.
    let child = Command::new(&ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-rtsp_transport",
            "tcp",
            "-i",
            &url,
            "-an",
            "-vf",
            "fps=8,scale=min(1280\\,iw):-2",
            "-q:v",
            "5",
            "-f",
            "image2",
            "-update",
            "1",
            "-y",
            &frame_str,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Не удалось запустить FFmpeg bridge: {e}"))?;

    *guard = Some(BridgeRuntime {
        child,
        url: url.clone(),
        frame_path: frame_path.clone(),
        started_at: Instant::now(),
    });

    Ok(RtspBridgeStatus {
        running: true,
        url: Some(url),
        frame_path: Some(frame_str),
        uptime_ms: Some(0),
        message: "RTSP JPEG bridge запущен".into(),
    })
}

#[tauri::command]
pub fn video_rtsp_bridge_stop(
    auth: State<'_, AuthSessionState>,
    bridge: State<'_, RtspBridgeState>,
) -> Result<RtspBridgeStatus, String> {
    auth_session::require_role_write(&auth)?;
    let mut guard = bridge.inner.lock().map_err(|e| e.to_string())?;
    stop_bridge_locked(&mut guard);
    Ok(RtspBridgeStatus {
        running: false,
        url: None,
        frame_path: None,
        uptime_ms: None,
        message: "RTSP bridge остановлен".into(),
    })
}

#[tauri::command]
pub fn video_rtsp_bridge_status(bridge: State<'_, RtspBridgeState>) -> Result<RtspBridgeStatus, String> {
    let mut guard = bridge.inner.lock().map_err(|e| e.to_string())?;
    let Some(rt) = guard.as_mut() else {
        return Ok(RtspBridgeStatus {
            running: false,
            url: None,
            frame_path: None,
            uptime_ms: None,
            message: "Bridge не запущен".into(),
        });
    };
    if let Ok(Some(status)) = rt.child.try_wait() {
        let code = status.code().unwrap_or(-1);
        stop_bridge_locked(&mut guard);
        return Ok(RtspBridgeStatus {
            running: false,
            url: None,
            frame_path: None,
            uptime_ms: None,
            message: format!("FFmpeg завершился (code {code}) — нет сигнала / ошибка декода"),
        });
    }
    Ok(RtspBridgeStatus {
        running: true,
        url: Some(rt.url.clone()),
        frame_path: Some(rt.frame_path.to_string_lossy().into()),
        uptime_ms: Some(rt.started_at.elapsed().as_millis() as u64),
        message: "Bridge активен".into(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RtspBridgeFrame {
    pub ok: bool,
    pub mime: String,
    pub base64: Option<String>,
    pub size_bytes: Option<u64>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn video_rtsp_bridge_frame(bridge: State<'_, RtspBridgeState>) -> Result<RtspBridgeFrame, String> {
    let guard = bridge.inner.lock().map_err(|e| e.to_string())?;
    let Some(rt) = guard.as_ref() else {
        return Ok(RtspBridgeFrame {
            ok: false,
            mime: "image/jpeg".into(),
            base64: None,
            size_bytes: None,
            error: Some("Bridge не запущен".into()),
        });
    };
    match std::fs::read(&rt.frame_path) {
        Ok(bytes) if bytes.len() > 100 && bytes[0] == 0xFF && bytes[1] == 0xD8 => {
            Ok(RtspBridgeFrame {
                ok: true,
                mime: "image/jpeg".into(),
                size_bytes: Some(bytes.len() as u64),
                base64: Some(base64_encode(&bytes)),
                error: None,
            })
        }
        Ok(_) => Ok(RtspBridgeFrame {
            ok: false,
            mime: "image/jpeg".into(),
            base64: None,
            size_bytes: None,
            error: Some("Кадр ещё не готов".into()),
        }),
        Err(_) => Ok(RtspBridgeFrame {
            ok: false,
            mime: "image/jpeg".into(),
            base64: None,
            size_bytes: None,
            error: Some("Кадр ещё не готов".into()),
        }),
    }
}

fn base64_encode(data: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}
