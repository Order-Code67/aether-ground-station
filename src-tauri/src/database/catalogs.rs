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
pub struct MastProfileRow {
    pub id: String,
    pub name: String,
    pub mast_type: String,
    pub height_m: f64,
    pub sections: Option<i64>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub mount_point_height_m: Option<f64>,
    pub levels: Option<i64>,
    pub payload: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntennaProfileRow {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub antenna_type: Option<String>,
    pub frequency_range: Option<String>,
    pub polarization: Option<String>,
    pub gain_dbi: Option<f64>,
    pub beamwidth_deg: Option<f64>,
    pub connector: Option<String>,
    pub mass_kg: Option<f64>,
    pub dimensions: Option<String>,
    pub payload: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntennaMountRow {
    pub id: String,
    pub station_id: String,
    pub antenna_profile_id: Option<String>,
    pub label: Option<String>,
    pub mount_height_m: Option<f64>,
    pub azimuth_deg: Option<f64>,
    pub elevation_deg: Option<f64>,
    pub tilt_deg: Option<f64>,
    pub azimuth_source: Option<String>,
    pub payload: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacementScenarioRow {
    pub id: String,
    pub name: String,
    pub complex_id: Option<String>,
    pub payload: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn mast_profile_list(state: State<'_, DbState>) -> Result<Vec<MastProfileRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, mast_type, height_m, sections, manufacturer, model,
                        mount_point_height_m, levels, payload, updated_at
                 FROM mast_profiles ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(MastProfileRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    mast_type: row.get(2)?,
                    height_m: row.get(3)?,
                    sections: row.get(4)?,
                    manufacturer: row.get(5).ok(),
                    model: row.get(6).ok(),
                    mount_point_height_m: row.get(7).ok(),
                    levels: row.get(8).ok(),
                    payload: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;
        collect(rows)
    })
}

#[tauri::command]
pub fn mast_profile_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: MastProfileRow,
) -> Result<MastProfileRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    let mut item = item;
    if item.updated_at.is_empty() {
        item.updated_at = now();
    }
    if item.payload.is_empty() {
        item.payload = "{}".into();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO mast_profiles(
                id, name, mast_type, height_m, sections, payload, updated_at,
                manufacturer, model, mount_point_height_m, levels
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, mast_type=excluded.mast_type, height_m=excluded.height_m,
                sections=excluded.sections, payload=excluded.payload, updated_at=excluded.updated_at,
                manufacturer=excluded.manufacturer, model=excluded.model,
                mount_point_height_m=excluded.mount_point_height_m, levels=excluded.levels",
            params![
                item.id,
                item.name,
                item.mast_type,
                item.height_m,
                item.sections,
                item.payload,
                item.updated_at,
                item.manufacturer,
                item.model,
                item.mount_point_height_m,
                item.levels,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[tauri::command]
pub fn antenna_profile_list(
    state: State<'_, DbState>,
) -> Result<Vec<AntennaProfileRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, manufacturer, model, antenna_type, frequency_range, polarization,
                        gain_dbi, beamwidth_deg, connector, mass_kg, dimensions, payload, updated_at
                 FROM antenna_profiles ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(AntennaProfileRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    manufacturer: row.get(2)?,
                    model: row.get(3)?,
                    antenna_type: row.get(4).ok(),
                    frequency_range: row.get(5).ok(),
                    polarization: row.get(6).ok(),
                    gain_dbi: row.get(7).ok(),
                    beamwidth_deg: row.get(8).ok(),
                    connector: row.get(9).ok(),
                    mass_kg: row.get(10).ok(),
                    dimensions: row.get(11).ok(),
                    payload: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            })
            .map_err(|e| e.to_string())?;
        collect(rows)
    })
}

#[tauri::command]
pub fn antenna_profile_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: AntennaProfileRow,
) -> Result<AntennaProfileRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    let mut item = item;
    if item.updated_at.is_empty() {
        item.updated_at = now();
    }
    if item.payload.is_empty() {
        item.payload = "{}".into();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO antenna_profiles(
                id, name, manufacturer, model, payload, updated_at,
                antenna_type, frequency_range, polarization, gain_dbi, beamwidth_deg,
                connector, mass_kg, dimensions
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, manufacturer=excluded.manufacturer, model=excluded.model,
                payload=excluded.payload, updated_at=excluded.updated_at,
                antenna_type=excluded.antenna_type, frequency_range=excluded.frequency_range,
                polarization=excluded.polarization, gain_dbi=excluded.gain_dbi,
                beamwidth_deg=excluded.beamwidth_deg, connector=excluded.connector,
                mass_kg=excluded.mass_kg, dimensions=excluded.dimensions",
            params![
                item.id,
                item.name,
                item.manufacturer,
                item.model,
                item.payload,
                item.updated_at,
                item.antenna_type,
                item.frequency_range,
                item.polarization,
                item.gain_dbi,
                item.beamwidth_deg,
                item.connector,
                item.mass_kg,
                item.dimensions,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[tauri::command]
pub fn antenna_mount_list(
    state: State<'_, DbState>,
    station_id: Option<String>,
) -> Result<Vec<AntennaMountRow>, String> {
    with_conn(&state, |conn| {
        if let Some(sid) = station_id {
            let mut stmt = conn
                .prepare(
                    "SELECT id, station_id, antenna_profile_id, label, mount_height_m,
                            azimuth_deg, elevation_deg, tilt_deg, azimuth_source, payload, updated_at
                     FROM station_antenna_mounts WHERE station_id=?1 ORDER BY label",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![sid], map_mount)
                .map_err(|e| e.to_string())?;
            collect(rows)
        } else {
            let mut stmt = conn
                .prepare(
                    "SELECT id, station_id, antenna_profile_id, label, mount_height_m,
                            azimuth_deg, elevation_deg, tilt_deg, azimuth_source, payload, updated_at
                     FROM station_antenna_mounts ORDER BY updated_at DESC",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], map_mount).map_err(|e| e.to_string())?;
            collect(rows)
        }
    })
}

fn map_mount(row: &rusqlite::Row<'_>) -> rusqlite::Result<AntennaMountRow> {
    Ok(AntennaMountRow {
        id: row.get(0)?,
        station_id: row.get(1)?,
        antenna_profile_id: row.get(2)?,
        label: row.get(3)?,
        mount_height_m: row.get(4)?,
        azimuth_deg: row.get(5)?,
        elevation_deg: row.get(6)?,
        tilt_deg: row.get(7)?,
        azimuth_source: row.get(8)?,
        payload: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

#[tauri::command]
pub fn antenna_mount_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: AntennaMountRow,
) -> Result<AntennaMountRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    let mut item = item;
    if item.updated_at.is_empty() {
        item.updated_at = now();
    }
    if item.payload.is_empty() {
        item.payload = "{}".into();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO station_antenna_mounts(
                id, station_id, antenna_profile_id, label, mount_height_m,
                azimuth_deg, elevation_deg, tilt_deg, azimuth_source, updated_at, payload
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
             ON CONFLICT(id) DO UPDATE SET
                station_id=excluded.station_id, antenna_profile_id=excluded.antenna_profile_id,
                label=excluded.label, mount_height_m=excluded.mount_height_m,
                azimuth_deg=excluded.azimuth_deg, elevation_deg=excluded.elevation_deg,
                tilt_deg=excluded.tilt_deg, azimuth_source=excluded.azimuth_source,
                updated_at=excluded.updated_at, payload=excluded.payload",
            params![
                item.id,
                item.station_id,
                item.antenna_profile_id,
                item.label,
                item.mount_height_m,
                item.azimuth_deg,
                item.elevation_deg,
                item.tilt_deg,
                item.azimuth_source,
                item.updated_at,
                item.payload,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[tauri::command]
pub fn antenna_mount_delete(
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
        conn.execute(
            "DELETE FROM station_antenna_mounts WHERE id=?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn placement_scenario_list(
    state: State<'_, DbState>,
) -> Result<Vec<PlacementScenarioRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, complex_id, payload, updated_at
                 FROM station_placement_scenarios ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(PlacementScenarioRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    complex_id: row.get(2)?,
                    payload: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        collect(rows)
    })
}

#[tauri::command]
pub fn placement_scenario_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: PlacementScenarioRow,
) -> Result<PlacementScenarioRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    let mut item = item;
    if item.updated_at.is_empty() {
        item.updated_at = now();
    }
    if item.payload.is_empty() {
        item.payload = "{}".into();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO station_placement_scenarios(id, name, complex_id, payload, updated_at)
             VALUES(?1,?2,?3,?4,?5)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, complex_id=excluded.complex_id,
                payload=excluded.payload, updated_at=excluded.updated_at",
            params![
                item.id,
                item.name,
                item.complex_id,
                item.payload,
                item.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

fn collect<T, E>(
    rows: impl IntoIterator<Item = Result<T, E>>,
) -> Result<Vec<T>, String>
where
    E: std::fmt::Display,
{
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}
