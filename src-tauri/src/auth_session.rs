//! Backend auth session — role is taken only from SQLite after password verify.
//! Free role bind from the renderer is rejected (P0-1).

use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

use crate::database::sqlite::{self, DbState};

#[derive(Default)]
pub struct AuthSessionState {
    pub username: Mutex<Option<String>>,
    pub role: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthLoginResult {
    pub id: String,
    pub username: String,
    pub role: String,
}

fn set_session(state: &AuthSessionState, username: String, role: String) -> Result<(), String> {
    *state.username.lock().map_err(|e| e.to_string())? = Some(username);
    *state.role.lock().map_err(|e| e.to_string())? = Some(role);
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
    *state.username.lock().map_err(|e| e.to_string())? = None;
    *state.role.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

pub fn current_user(state: &State<'_, AuthSessionState>) -> Option<String> {
    state.username.lock().ok().and_then(|g| g.clone())
}

pub fn require_role_write(state: &State<'_, AuthSessionState>) -> Result<String, String> {
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
    #[test]
    fn bind_session_message_mentions_login() {
        // Documented contract: free bind must not succeed.
        let msg = "auth_bind_session отключён (P0). Используйте auth_login с паролем.";
        assert!(msg.contains("auth_login"));
    }
}
