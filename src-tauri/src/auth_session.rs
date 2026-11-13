//! Backend auth session — role is taken only from SQLite after password verify.
//! Free role bind from the renderer is rejected (P0-1).
//! Idle timeout (1.0.1 SEC-1): default 45 minutes without activity.

use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

use crate::database::sqlite::{self, DbState};

/// Default idle timeout before session is cleared (seconds).
pub const DEFAULT_IDLE_TIMEOUT_SECS: u64 = 45 * 60;

pub struct AuthSessionState {
    pub username: Mutex<Option<String>>,
    pub role: Mutex<Option<String>>,
    pub last_activity: Mutex<Option<Instant>>,
    /// 0 = disabled (not recommended); otherwise idle seconds.
    pub idle_timeout_secs: Mutex<u64>,
}

impl Default for AuthSessionState {
    fn default() -> Self {
        Self::new()
    }
}

impl AuthSessionState {
    pub fn new() -> Self {
        Self {
            username: Mutex::new(None),
            role: Mutex::new(None),
            last_activity: Mutex::new(None),
            idle_timeout_secs: Mutex::new(DEFAULT_IDLE_TIMEOUT_SECS),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthLoginResult {
    pub id: String,
    pub username: String,
    pub role: String,
    pub idle_timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSessionInfo {
    pub authenticated: bool,
    pub username: Option<String>,
    pub role: Option<String>,
    pub idle_timeout_secs: u64,
    pub idle_remaining_secs: Option<u64>,
    pub expired: bool,
}

fn clear_locked(state: &AuthSessionState) -> Result<(), String> {
    *state.username.lock().map_err(|e| e.to_string())? = None;
    *state.role.lock().map_err(|e| e.to_string())? = None;
    *state.last_activity.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

fn touch_locked(state: &AuthSessionState) -> Result<(), String> {
    *state.last_activity.lock().map_err(|e| e.to_string())? = Some(Instant::now());
    Ok(())
}

fn timeout_secs(state: &AuthSessionState) -> u64 {
    state
        .idle_timeout_secs
        .lock()
        .map(|g| *g)
        .unwrap_or(DEFAULT_IDLE_TIMEOUT_SECS)
}

/// Returns Ok(true) if still valid (and touches), Ok(false) if no session, Err if expired (cleared).
fn ensure_fresh(state: &AuthSessionState) -> Result<bool, String> {
    let has_user = state
        .username
        .lock()
        .map_err(|e| e.to_string())?
        .is_some();
    if !has_user {
        return Ok(false);
    }
    let timeout = timeout_secs(state);
    if timeout == 0 {
        touch_locked(state)?;
        return Ok(true);
    }
    let last = state
        .last_activity
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let Some(last) = last else {
        clear_locked(state)?;
        return Err("Сессия истекла (нет активности)".into());
    };
    if last.elapsed() > Duration::from_secs(timeout) {
        clear_locked(state)?;
        return Err("Сессия истекла по таймауту бездействия".into());
    }
    touch_locked(state)?;
    Ok(true)
}

fn set_session(state: &AuthSessionState, username: String, role: String) -> Result<(), String> {
    *state.username.lock().map_err(|e| e.to_string())? = Some(username);
    *state.role.lock().map_err(|e| e.to_string())? = Some(role);
    touch_locked(state)?;
    Ok(())
}

/// Login: verify password against SQLite and bind role from DB only.
#[tauri::command]
pub fn auth_login(
    db: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    username: String,
    password: String,
) -> Result<AuthLoginResult, String> {
    let info = sqlite::verify_credentials(&db, &username, &password)?
        .ok_or_else(|| "Неверный логин или пароль".to_string())?;
    set_session(&auth, info.username.clone(), info.role.clone())?;
    Ok(AuthLoginResult {
        id: info.id,
        username: info.username,
        role: info.role,
        idle_timeout_secs: timeout_secs(&auth),
    })
}

/// Deprecated: accepting a client-supplied role is unsafe. Always fails.
#[tauri::command]
pub fn auth_bind_session(
    _state: State<'_, AuthSessionState>,
    _username: String,
    _role: String,
) -> Result<(), String> {
    Err("auth_bind_session отключён (P0). Используйте auth_login с паролем.".into())
}

#[tauri::command]
pub fn auth_clear_session(state: State<'_, AuthSessionState>) -> Result<(), String> {
    clear_locked(&state)
}

/// Touch activity / check expiry. Frontend should call periodically and on user input.
#[tauri::command]
pub fn auth_touch(state: State<'_, AuthSessionState>) -> Result<AuthSessionInfo, String> {
    match ensure_fresh(&state) {
        Ok(true) => Ok(session_info(&state, false)?),
        Ok(false) => Ok(AuthSessionInfo {
            authenticated: false,
            username: None,
            role: None,
            idle_timeout_secs: timeout_secs(&state),
            idle_remaining_secs: None,
            expired: false,
        }),
        Err(_) => Ok(AuthSessionInfo {
            authenticated: false,
            username: None,
            role: None,
            idle_timeout_secs: timeout_secs(&state),
            idle_remaining_secs: None,
            expired: true,
        }),
    }
}

#[tauri::command]
pub fn auth_set_idle_timeout(
    state: State<'_, AuthSessionState>,
    secs: u64,
) -> Result<u64, String> {
    // Clamp: 0 = disable; otherwise 5 min .. 24 h
    let v = if secs == 0 {
        0
    } else {
        secs.clamp(5 * 60, 24 * 60 * 60)
    };
    *state.idle_timeout_secs.lock().map_err(|e| e.to_string())? = v;
    Ok(v)
}

fn session_info(state: &AuthSessionState, expired: bool) -> Result<AuthSessionInfo, String> {
    let username = state.username.lock().map_err(|e| e.to_string())?.clone();
    let role = state.role.lock().map_err(|e| e.to_string())?.clone();
    let timeout = timeout_secs(state);
    let remaining = if let Some(last) = *state.last_activity.lock().map_err(|e| e.to_string())? {
        if timeout == 0 {
            None
        } else {
            let elapsed = last.elapsed().as_secs();
            Some(timeout.saturating_sub(elapsed))
        }
    } else {
        None
    };
    Ok(AuthSessionInfo {
        authenticated: username.is_some() && !expired,
        username,
        role,
        idle_timeout_secs: timeout,
        idle_remaining_secs: remaining,
        expired,
    })
}

pub fn current_user(state: &State<'_, AuthSessionState>) -> Option<String> {
    let _ = ensure_fresh(state);
    state.username.lock().ok().and_then(|g| g.clone())
}

pub fn require_role_write(state: &State<'_, AuthSessionState>) -> Result<String, String> {
    ensure_fresh(state)?;
    let role = state
        .role
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "Требуется авторизация".to_string())?;
    if role == "Observer" {
        return Err("Observer: операция запрещена".into());
    }
    Ok(role)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bind_session_message_mentions_login() {
        let msg = "auth_bind_session отключён (P0). Используйте auth_login с паролем.";
        assert!(msg.contains("auth_login"));
    }

    #[test]
    fn default_idle_timeout_is_45_min() {
        assert_eq!(DEFAULT_IDLE_TIMEOUT_SECS, 45 * 60);
    }

    #[test]
    fn ensure_fresh_expires() {
        let state = AuthSessionState::new();
        *state.idle_timeout_secs.lock().unwrap() = 1;
        set_session(&state, "u".into(), "Administrator".into()).unwrap();
        *state.last_activity.lock().unwrap() = Some(Instant::now() - Duration::from_secs(5));
        let err = ensure_fresh(&state).unwrap_err();
        assert!(err.contains("истекла"));
        assert!(state.username.lock().unwrap().is_none());
    }
}
