use directories::ProjectDirs;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct DbState {
    pub conn: Mutex<Option<Connection>>,
}

impl Default for DbState {
    fn default() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }
}

fn db_path() -> Result<PathBuf, String> {
    let dirs = ProjectDirs::from("com", "aether", "ground-station")
        .ok_or_else(|| "Не удалось определить каталог данных".to_string())?;
    let dir = dirs.data_dir();
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(dir.join("ags.sqlite"))
}

pub fn with_conn<T>(
    state: &State<'_, DbState>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    let conn = guard
        .as_ref()
        .ok_or_else(|| "БД не инициализирована".to_string())?;
    f(conn)
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(b":");
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn open_and_migrate(state: &DbState) -> Result<String, String> {
    let path = db_path()?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    super::migrations::apply_migrations(&conn)?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
        .unwrap_or(0);
    if count == 0 {
        let salt = format!("{:x}", Sha256::digest(b"aether-gs-default-salt"));
        let hash = hash_password("admin", &salt);
        conn.execute(
            "INSERT INTO users(id, username, role, password_hash, salt, disabled, configuration)
             VALUES(?1,?2,?3,?4,?5,0,'{}')",
            params!["usr_admin", "admin", "Administrator", hash, salt],
        )
        .map_err(|e| e.to_string())?;
    }
    let mut guard = state.conn.lock().map_err(|_| "DB lock".to_string())?;
    *guard = Some(conn);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn db_schema_version(state: State<'_, DbState>) -> Result<i64, String> {
    with_conn(&state, |conn| {
        conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn db_init(state: State<'_, DbState>) -> Result<String, String> {
    open_and_migrate(&state)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbEvent {
    pub id: String,
    pub at: String,
    pub severity: String,
    pub source: String,
    pub message: String,
}

#[tauri::command]
pub fn db_append_event(
    state: State<'_, DbState>,
    id: String,
    at: String,
    severity: String,
    source: String,
    message: String,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT OR REPLACE INTO event_log (id, at, severity, source, message, details) VALUES (?1,?2,?3,?4,?5,NULL)",
            params![id, at, severity, source, message],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn db_list_events(state: State<'_, DbState>, limit: i64) -> Result<Vec<DbEvent>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, at, severity, source, message FROM event_log ORDER BY at DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(DbEvent {
                    id: row.get(0)?,
                    at: row.get(1)?,
                    severity: row.get(2)?,
                    source: row.get(3)?,
                    message: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn db_upsert_setting(
    state: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    if key.to_lowercase().contains("password") || key.to_lowercase().contains("secret") {
        if !value.starts_with("enc:") {
            return Err("Секреты нельзя сохранять открытым текстом".into());
        }
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO settings_kv(key, value) VALUES(?1,?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn db_get_setting(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT value FROM settings_kv WHERE key=?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            Ok(Some(row.get(0).map_err(|e| e.to_string())?))
        } else {
            Ok(None)
        }
    })
}

#[tauri::command]
pub fn db_backup(state: State<'_, DbState>) -> Result<String, String> {
    let path = db_path()?;
    let backup = path.with_extension("sqlite.bak");
    let _ = with_conn(&state, |_| Ok(()))?;
    std::fs::copy(&path, &backup).map_err(|e| e.to_string())?;
    Ok(backup.to_string_lossy().to_string())
}

#[tauri::command]
pub fn db_upsert_json(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    // validate JSON
    let _: Value = serde_json::from_str(&value).map_err(|e| format!("Неверный JSON: {e}"))?;
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO kv_json(key, value) VALUES(?1,?2)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn db_get_json(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    with_conn(&state, |conn| {
        conn.query_row("SELECT value FROM kv_json WHERE key=?1", params![key], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbUser {
    pub id: String,
    pub username: String,
    pub role: String,
    pub disabled: bool,
}

#[tauri::command]
pub fn db_list_users(state: State<'_, DbState>) -> Result<Vec<DbUser>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, username, role, disabled FROM users ORDER BY username")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DbUser {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    role: row.get(2)?,
                    disabled: row.get::<_, i64>(3)? != 0,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn db_upsert_user(
    state: State<'_, DbState>,
    auth: State<'_, crate::auth_session::AuthSessionState>,
    id: String,
    username: String,
    role: String,
    password: Option<String>,
    disabled: bool,
) -> Result<DbUser, String> {
    crate::auth_session::require_role_write(&auth)?;
    crate::database::permissions::require(
        &state,
        crate::auth_session::current_user(&auth).as_deref(),
        crate::database::permissions::Permission::ManageUsers,
    )?;
    let role = match role.as_str() {
        "Administrator" | "Operator" | "Observer" => role,
        _ => return Err("Роль: Administrator | Operator | Observer".into()),
    };
    let username = username.trim().to_string();
    if username.is_empty() {
        return Err("Имя пользователя пусто".into());
    }
    with_conn(&state, |conn| {
        let existing: Option<(String, String)> = conn
            .query_row(
                "SELECT password_hash, salt FROM users WHERE id=?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let (hash, salt) = if let Some(pw) = password.filter(|p| !p.is_empty()) {
            let salt = format!("s_{}", id);
            (hash_password(&pw, &salt), salt)
        } else if let Some((h, s)) = existing {
            (h, s)
        } else {
            let salt = format!("s_{}", id);
            (hash_password("changeme", &salt), salt)
        };

        conn.execute(
            "INSERT INTO users(id, username, role, password_hash, salt, disabled, configuration)
             VALUES(?1,?2,?3,?4,?5,?6,'{}')
             ON CONFLICT(id) DO UPDATE SET
               username=excluded.username, role=excluded.role,
               password_hash=excluded.password_hash, salt=excluded.salt,
               disabled=excluded.disabled",
            params![id, username, role, hash, salt, disabled as i64],
        )
        .map_err(|e| e.to_string())?;

        let _ = conn.execute(
            "INSERT INTO audit_log(id, user_id, timestamp, event, details)
             VALUES(?1, ?2, datetime('now'), 'user_upsert', ?3)",
            params![
                format!(
                    "aud_{}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0)
                ),
                crate::auth_session::current_user(&auth).unwrap_or_else(|| "system".into()),
                format!("{username}/{role}/disabled={disabled}")
            ],
        );

        Ok(DbUser {
            id,
            username,
            role,
            disabled,
        })
    })
}

#[tauri::command]
pub fn db_verify_user_password(
    state: State<'_, DbState>,
    username: String,
    password: String,
) -> Result<bool, String> {
    with_conn(&state, |conn| {
        let row: Option<(String, String, i64)> = conn
            .query_row(
                "SELECT password_hash, salt, disabled FROM users WHERE lower(username)=lower(?1)",
                params![username],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let Some((hash, salt, disabled)) = row else {
            return Ok(false);
        };
        if disabled != 0 {
            return Ok(false);
        }
        Ok(hash_password(&password, &salt) == hash)
    })
}

#[tauri::command]
pub fn db_upsert_recording(
    state: State<'_, DbState>,
    id: String,
    source_id: String,
    filename: String,
    start_time: String,
    end_time: Option<String>,
    metadata: String,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT OR REPLACE INTO recordings(id, source_id, filename, start_time, end_time, metadata)
             VALUES(?1,?2,?3,?4,?5,?6)",
            params![id, source_id, filename, start_time, end_time, metadata],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbRecording {
    pub id: String,
    pub source_id: Option<String>,
    pub filename: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub metadata: Option<String>,
}

#[tauri::command]
pub fn db_list_recordings(state: State<'_, DbState>) -> Result<Vec<DbRecording>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, source_id, filename, start_time, end_time, metadata
                 FROM recordings ORDER BY start_time DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DbRecording {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    filename: row.get(2)?,
                    start_time: row.get(3)?,
                    end_time: row.get(4)?,
                    metadata: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn db_audit(
    state: State<'_, DbState>,
    id: String,
    user_id: Option<String>,
    timestamp: String,
    event: String,
    details: Option<String>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO audit_log(id, user_id, timestamp, event, details) VALUES(?1,?2,?3,?4,?5)",
            params![id, user_id, timestamp, event, details],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}
