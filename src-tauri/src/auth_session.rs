use std::sync::Mutex;

#[derive(Default)]
pub struct AuthSessionState {
    pub username: Mutex<Option<String>>,
    pub role: Mutex<Option<String>>,
}

#[tauri::command]
pub fn auth_bind_session(
    state: tauri::State<'_, AuthSessionState>,
    username: String,
    role: String,
) -> Result<(), String> {
    *state.username.lock().map_err(|e| e.to_string())? = Some(username);
    *state.role.lock().map_err(|e| e.to_string())? = Some(role);
    Ok(())
}

#[tauri::command]
pub fn auth_clear_session(state: tauri::State<'_, AuthSessionState>) -> Result<(), String> {
    *state.username.lock().map_err(|e| e.to_string())? = None;
    *state.role.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

pub fn current_user(state: &tauri::State<'_, AuthSessionState>) -> Option<String> {
    state.username.lock().ok().and_then(|g| g.clone())
}

pub fn require_role_write(state: &tauri::State<'_, AuthSessionState>) -> Result<String, String> {
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
