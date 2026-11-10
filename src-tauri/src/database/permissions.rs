//! Backend permission checks — roles must be enforced on commands, not only UI.

use rusqlite::{params, OptionalExtension};
use tauri::State;

use super::sqlite::{with_conn, DbState};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    ManageUsers,
    ManageDevices,
    ManageConfig,
    ManagePlugins,
    WriteHardware,
    ViewOnly,
}

pub fn role_allows(role: &str, perm: Permission) -> bool {
    match role {
        "Administrator" => true,
        "Operator" => matches!(
            perm,
            Permission::ManageDevices | Permission::WriteHardware | Permission::ViewOnly
        ),
        "Observer" => matches!(perm, Permission::ViewOnly),
        _ => false,
    }
}

pub fn user_role(state: &State<'_, DbState>, username: &str) -> Result<Option<String>, String> {
    with_conn(state, |conn| {
        let row = conn
            .query_row(
                "SELECT role, disabled FROM users WHERE lower(username)=lower(?1)",
                params![username],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(match row {
            Some((role, 0)) => Some(role),
            _ => None,
        })
    })
}

pub fn require(
    state: &State<'_, DbState>,
    username: Option<&str>,
    perm: Permission,
) -> Result<(), String> {
    if matches!(perm, Permission::ViewOnly) {
        return Ok(());
    }
    let Some(user) = username.filter(|u| !u.is_empty()) else {
        return Err("Требуется авторизация".into());
    };
    let role = user_role(state, user)?
        .ok_or_else(|| "Пользователь не найден или отключён".to_string())?;
    if role_allows(&role, perm) {
        Ok(())
    } else {
        Err(format!("Недостаточно прав ({role})"))
    }
}
