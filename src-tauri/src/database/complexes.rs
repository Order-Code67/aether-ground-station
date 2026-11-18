use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::auth_session::{self, AuthSessionState};

use super::permissions::{self, Permission};
use super::sqlite::{with_conn, DbState};

fn now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplexRow {
    pub id: String,
    pub name: String,
    pub status: String,
    pub region: Option<String>,
    pub payload: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteRow {
    pub id: String,
    pub complex_id: Option<String>,
    pub name: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub description: Option<String>,
    pub address: Option<String>,
    pub status: String,
    pub payload: String,
    pub created_at: Option<String>,
    pub updated_at: String,
}

#[tauri::command]
pub fn complex_list(state: State<'_, DbState>) -> Result<Vec<ComplexRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, status, region, payload, updated_at FROM complexes ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(ComplexRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    status: row.get(2)?,
                    region: row.get(3)?,
                    payload: row.get(4)?,
                    updated_at: row.get(5)?,
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
pub fn complex_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: ComplexRow,
) -> Result<ComplexRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    let mut item = item;
    if item.status.is_empty() {
        item.status = "unknown".into();
    }
    if item.payload.is_empty() {
        item.payload = "{}".into();
    }
    if item.updated_at.is_empty() {
        item.updated_at = now();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO complexes(id, name, status, region, payload, updated_at)
             VALUES(?1,?2,?3,?4,?5,?6)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, status=excluded.status, region=excluded.region,
               payload=excluded.payload, updated_at=excluded.updated_at",
            params![
                item.id,
                item.name,
                item.status,
                item.region,
                item.payload,
                item.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[tauri::command]
pub fn complex_delete(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    id: String,
) -> Result<(), String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM complexes WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn site_list(
    state: State<'_, DbState>,
    complex_id: Option<String>,
) -> Result<Vec<SiteRow>, String> {
    with_conn(&state, |conn| {
        let mut out = Vec::new();
        if let Some(cid) = complex_id {
            let mut stmt = conn
                .prepare(
                    "SELECT id, complex_id, name, latitude, longitude, description, address,
                            status, payload, created_at, updated_at
                     FROM station_sites WHERE complex_id=?1 ORDER BY name",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![cid], map_site)
                .map_err(|e| e.to_string())?;
            for r in rows {
                out.push(r.map_err(|e| e.to_string())?);
            }
        } else {
            let mut stmt = conn
                .prepare(
                    "SELECT id, complex_id, name, latitude, longitude, description, address,
                            status, payload, created_at, updated_at
                     FROM station_sites ORDER BY name",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], map_site).map_err(|e| e.to_string())?;
            for r in rows {
                out.push(r.map_err(|e| e.to_string())?);
            }
        }
        Ok(out)
    })
}

fn map_site(row: &rusqlite::Row<'_>) -> rusqlite::Result<SiteRow> {
    Ok(SiteRow {
        id: row.get(0)?,
        complex_id: row.get(1)?,
        name: row.get(2)?,
        latitude: row.get(3)?,
        longitude: row.get(4)?,
        description: row.get(5)?,
        address: row.get(6)?,
        status: row.get(7).unwrap_or_else(|_| "unknown".into()),
        payload: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

#[tauri::command]
pub fn site_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: SiteRow,
) -> Result<SiteRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    if let (Some(lat), Some(lng)) = (item.latitude, item.longitude) {
        validate_coords(lat, lng)?;
    }
    let mut item = item;
    if item.status.is_empty() {
        item.status = "unknown".into();
    }
    if item.payload.is_empty() {
        item.payload = "{}".into();
    }
    if item.updated_at.is_empty() {
        item.updated_at = now();
    }
    if item.created_at.is_none() {
        item.created_at = Some(item.updated_at.clone());
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO station_sites(
                id, name, latitude, longitude, description, payload, updated_at,
                complex_id, status, address, created_at
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude,
                description=excluded.description, payload=excluded.payload,
                updated_at=excluded.updated_at, complex_id=excluded.complex_id,
                status=excluded.status, address=excluded.address,
                created_at=COALESCE(station_sites.created_at, excluded.created_at)",
            params![
                item.id,
                item.name,
                item.latitude,
                item.longitude,
                item.description,
                item.payload,
                item.updated_at,
                item.complex_id,
                item.status,
                item.address,
                item.created_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[tauri::command]
pub fn site_delete(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    id: String,
) -> Result<(), String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM station_sites WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

pub fn validate_coords(lat: f64, lng: f64) -> Result<(), String> {
    if !(-90.0..=90.0).contains(&lat) {
        return Err(format!("Широта вне диапазона: {lat}"));
    }
    if !(-180.0..=180.0).contains(&lng) {
        return Err(format!("Долгота вне диапазона: {lng}"));
    }
    if lat.is_nan() || lng.is_nan() {
        return Err("Координаты NaN".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_coords;

    #[test]
    fn coords_ok() {
        assert!(validate_coords(55.75, 37.62).is_ok());
        assert!(validate_coords(91.0, 0.0).is_err());
        assert!(validate_coords(0.0, 200.0).is_err());
    }
}
