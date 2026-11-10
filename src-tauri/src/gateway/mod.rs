//! Central Gateway client — outbox sync, TCP/HTTP probe, optional PostgreSQL DSN health.
//! Local SQLite remains SSOT offline. No pilot/actuator remote channel.

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;
use tauri::State;

use crate::auth_session::{self, AuthSessionState};
use crate::database::sqlite::{with_conn, DbState};
use rusqlite::params;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConfig {
    pub enabled: bool,
    pub http_base_url: String,
    pub postgres_dsn: String,
    pub stale_after_sec: u64,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            http_base_url: String::new(),
            postgres_dsn: String::new(),
            stale_after_sec: 120,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    pub enabled: bool,
    pub http_reachable: Option<bool>,
    pub postgres_reachable: Option<bool>,
    pub pending_outbox: i64,
    pub last_sync_at: Option<String>,
    pub stale: bool,
    pub message: String,
}

fn load_config(state: &State<'_, DbState>) -> GatewayConfig {
    with_conn(state, |conn| {
        let raw: Result<String, _> =
            conn.query_row("SELECT value FROM settings_kv WHERE key='gateway_config'", [], |r| {
                r.get(0)
            });
        Ok(match raw {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => GatewayConfig::default(),
        })
    })
    .unwrap_or_default()
}

fn save_config(state: &State<'_, DbState>, cfg: &GatewayConfig) -> Result<(), String> {
    let json = serde_json::to_string(cfg).map_err(|e| e.to_string())?;
    with_conn(state, |conn| {
        conn.execute(
            "INSERT INTO settings_kv(key, value) VALUES('gateway_config', ?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![json],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

fn outbox_pending(state: &State<'_, DbState>) -> i64 {
    with_conn(state, |conn| {
        Ok(conn
            .query_row(
                "SELECT COUNT(*) FROM sync_outbox WHERE status='pending'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0))
    })
    .unwrap_or(0)
}

fn last_sync(state: &State<'_, DbState>) -> Option<String> {
    with_conn(state, |conn| {
        let v: Result<String, _> =
            conn.query_row("SELECT value FROM settings_kv WHERE key='gateway_last_sync'", [], |r| {
                r.get(0)
            });
        Ok(v.ok())
    })
    .ok()
    .flatten()
}

fn parse_host_port_from_url(url: &str) -> Option<(String, u16)> {
    let u = url.trim();
    let rest = u
        .strip_prefix("https://")
        .or_else(|| u.strip_prefix("http://"))
        .or_else(|| u.strip_prefix("wss://"))
        .or_else(|| u.strip_prefix("ws://"))
        .unwrap_or(u);
    let hostport = rest.split('/').next()?.split('@').last()?;
    if let Some((h, p)) = hostport.rsplit_once(':') {
        let port: u16 = p.parse().ok()?;
        Some((h.to_string(), port))
    } else {
        let port = if u.starts_with("https") || u.starts_with("wss") {
            443
        } else {
            80
        };
        Some((hostport.to_string(), port))
    }
}

fn parse_pg_host_port(dsn: &str) -> Option<(String, u16)> {
    // postgresql://user:pass@host:5432/db or host=.. port=..
    let d = dsn.trim();
    if d.contains("://") {
        return parse_host_port_from_url(d);
    }
    let mut host = None;
    let mut port = 5432u16;
    for part in d.split(|c| c == ' ' || c == ';') {
        if let Some(h) = part.strip_prefix("host=") {
            host = Some(h.to_string());
        }
        if let Some(p) = part.strip_prefix("port=") {
            if let Ok(n) = p.parse() {
                port = n;
            }
        }
    }
    host.map(|h| (h, port))
}

fn tcp_reachable(host: &str, port: u16, timeout_ms: u64) -> bool {
    let addr = format!("{host}:{port}");
    let Ok(mut addrs) = addr.to_socket_addrs() else {
        return false;
    };
    let Some(a) = addrs.next() else {
        return false;
    };
    TcpStream::connect_timeout(&a, Duration::from_millis(timeout_ms)).is_ok()
}

fn http_post_json(base: &str, path: &str, body: &str) -> Result<u16, String> {
    let base = base.trim_end_matches('/');
    let url = format!("{base}{path}");
    let (host, port) = parse_host_port_from_url(&url)
        .ok_or_else(|| "Некорректный gateway URL".to_string())?;
    let path_q = url
        .split_once("://")
        .and_then(|(_, rest)| rest.find('/').map(|i| &rest[i..]))
        .unwrap_or("/");
    let mut stream = TcpStream::connect_timeout(
        &format!("{host}:{port}")
            .to_socket_addrs()
            .map_err(|e| e.to_string())?
            .next()
            .ok_or_else(|| "DNS fail".to_string())?,
        Duration::from_secs(5),
    )
    .map_err(|e| format!("TCP: {e}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .ok();
    let req = format!(
        "POST {path_q} HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    let _ = stream.read_to_end(&mut buf);
    let text = String::from_utf8_lossy(&buf);
    let code = text
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|c| c.parse().ok())
        .unwrap_or(0);
    Ok(code)
}

#[tauri::command]
pub fn gateway_get_config(state: State<'_, DbState>) -> Result<GatewayConfig, String> {
    Ok(load_config(&state))
}

#[tauri::command]
pub fn gateway_set_config(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    config: GatewayConfig,
) -> Result<GatewayConfig, String> {
    auth_session::require_role_write(&auth)?;
    save_config(&state, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn gateway_status(state: State<'_, DbState>) -> Result<GatewayStatus, String> {
    let cfg = load_config(&state);
    if !cfg.enabled {
        return Ok(GatewayStatus {
            enabled: false,
            http_reachable: None,
            postgres_reachable: None,
            pending_outbox: outbox_pending(&state),
            last_sync_at: last_sync(&state),
            stale: false,
            message: "Gateway выключен — локальный SQLite SSOT".into(),
        });
    }
    let http_ok = if cfg.http_base_url.trim().is_empty() {
        None
    } else {
        parse_host_port_from_url(&cfg.http_base_url)
            .map(|(h, p)| tcp_reachable(&h, p, 2000))
    };
    let pg_ok = if cfg.postgres_dsn.trim().is_empty() {
        None
    } else {
        parse_pg_host_port(&cfg.postgres_dsn).map(|(h, p)| tcp_reachable(&h, p, 2000))
    };
    let last = last_sync(&state);
    let stale = match &last {
        Some(ts) => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let then: u64 = ts.parse().unwrap_or(0);
            now.saturating_sub(then) > cfg.stale_after_sec
        }
        None => true,
    };
    let message = match (http_ok, pg_ok) {
        (Some(false), _) => "HTTP gateway недоступен — данные могут быть stale".into(),
        (_, Some(false)) => "PostgreSQL недоступен (probe) — outbox копится локально".into(),
        (Some(true), _) | (_, Some(true)) => "Канал Central Gateway доступен".into(),
        _ => "Gateway включён, endpoints не заданы".into(),
    };
    Ok(GatewayStatus {
        enabled: true,
        http_reachable: http_ok,
        postgres_reachable: pg_ok,
        pending_outbox: outbox_pending(&state),
        last_sync_at: last,
        stale,
        message,
    })
}

#[tauri::command]
pub fn gateway_enqueue(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    kind: String,
    payload: String,
) -> Result<String, String> {
    auth_session::require_role_write(&auth)?;
    let _: serde_json::Value =
        serde_json::from_str(&payload).map_err(|e| format!("JSON: {e}"))?;
    let id = format!("out_{}", chrono_now());
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO sync_outbox(id, kind, payload, status, created_at, updated_at)
             VALUES(?1,?2,?3,'pending',?4,?4)",
            params![id, kind, payload, chrono_now()],
        )
        .map_err(|e| e.to_string())?;
        Ok(id.clone())
    })
}

#[tauri::command]
pub fn gateway_try_sync(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
) -> Result<GatewayStatus, String> {
    auth_session::require_role_write(&auth)?;
    let cfg = load_config(&state);
    if !cfg.enabled {
        return gateway_status(state);
    }
    if cfg.http_base_url.trim().is_empty() {
        return Err("Задайте httpBaseUrl для sync".into());
    }

    let rows: Vec<(String, String, String)> = with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, payload FROM sync_outbox WHERE status='pending' ORDER BY created_at LIMIT 50",
            )
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(|e| e.to_string())?;
        let mut v = Vec::new();
        for row in iter {
            v.push(row.map_err(|e| e.to_string())?);
        }
        Ok(v)
    })?;

    if rows.is_empty() {
        let now = chrono_now();
        with_conn(&state, |conn| {
            conn.execute(
                "INSERT INTO settings_kv(key, value) VALUES('gateway_last_sync', ?1)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                params![now],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })?;
        return gateway_status(state);
    }

    let batch = serde_json::json!({
        "items": rows.iter().map(|(id, kind, payload)| {
            serde_json::json!({
                "id": id,
                "kind": kind,
                "payload": serde_json::from_str::<serde_json::Value>(payload).unwrap_or(serde_json::Value::Null),
            })
        }).collect::<Vec<_>>(),
    });
    let body = serde_json::to_string(&batch).unwrap_or_else(|_| "{}".into());
    let code = http_post_json(&cfg.http_base_url, "/api/v1/sync", &body)?;
    if !(200..300).contains(&code) {
        return Err(format!("Gateway sync HTTP {code}"));
    }

    let now = chrono_now();
    with_conn(&state, |conn| {
        for (id, _, _) in &rows {
            conn.execute(
                "UPDATE sync_outbox SET status='sent', updated_at=?2 WHERE id=?1",
                params![id, now],
            )
            .map_err(|e| e.to_string())?;
        }
        conn.execute(
            "INSERT INTO settings_kv(key, value) VALUES('gateway_last_sync', ?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![now],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;

    gateway_status(state)
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}
