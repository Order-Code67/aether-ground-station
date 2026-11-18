use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::auth_session::{self, AuthSessionState};

use super::complexes::validate_coords;
use super::permissions::{self, Permission};
use super::sqlite::{with_conn, DbState};

/// AMSL only when terrain and mast are known. Offset defaults to 0 when None.
pub fn antenna_center_amsl(
    terrain_elevation_m: Option<f64>,
    mast_height_m: Option<f64>,
    antenna_offset_m: Option<f64>,
) -> Option<f64> {
    let e = terrain_elevation_m?;
    let m = mast_height_m?;
    let o = antenna_offset_m.unwrap_or(0.0);
    Some(e + m + o)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationRow {
    pub id: String,
    pub complex_id: Option<String>,
    pub site_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub terrain_elevation_m: Option<f64>,
    pub mast_height_m: Option<f64>,
    pub antenna_offset_m: Option<f64>,
    pub antenna_center_amsl_m: Option<f64>,
    pub mast_type: Option<String>,
    pub antenna_type: Option<String>,
    pub equipment_model: Option<String>,
    pub azimuth_deg: Option<f64>,
    pub azimuth_ref: Option<String>,
    pub elevation_deg: Option<f64>,
    pub tilt_deg: Option<f64>,
    pub pan_tilt_status: Option<String>,
    pub equipment_status: Option<String>,
    pub notes: Option<String>,
    pub payload: String,
    #[serde(default)]
    pub created_at: Option<String>,
    pub updated_at: String,
}

#[tauri::command]
pub fn station_list(
    state: State<'_, DbState>,
    complex_id: Option<String>,
    site_id: Option<String>,
) -> Result<Vec<StationRow>, String> {
    with_conn(&state, |conn| {
        let mut sql = String::from(
            "SELECT id, complex_id, site_id, name, description, status, latitude, longitude,
                    terrain_elevation_m, mast_height_m, antenna_offset_m, antenna_center_amsl_m,
                    mast_type, antenna_type, equipment_model, azimuth_deg, azimuth_ref,
                    elevation_deg, tilt_deg, pan_tilt_status, equipment_status, notes,
                    payload, created_at, updated_at
             FROM stations WHERE 1=1",
        );
        if complex_id.is_some() {
            sql.push_str(" AND complex_id=?1");
        }
        if site_id.is_some() {
            if complex_id.is_some() {
                sql.push_str(" AND site_id=?2");
            } else {
                sql.push_str(" AND site_id=?1");
            }
        }
        sql.push_str(" ORDER BY name");

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let mapped = match (complex_id.as_ref(), site_id.as_ref()) {
            (Some(c), Some(s)) => {
                let rows = stmt
                    .query_map(params![c, s], map_station)
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
            }
            (Some(c), None) => {
                let rows = stmt
                    .query_map(params![c], map_station)
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
            }
            (None, Some(s)) => {
                let rows = stmt
                    .query_map(params![s], map_station)
                    .map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
            }
            (None, None) => {
                let rows = stmt.query_map([], map_station).map_err(|e| e.to_string())?;
                rows.collect::<Result<Vec<_>, _>>()
            }
        }
        .map_err(|e| e.to_string())?;
        Ok(mapped)
    })
}

fn map_station(row: &rusqlite::Row<'_>) -> rusqlite::Result<StationRow> {
    Ok(StationRow {
        id: row.get(0)?,
        complex_id: row.get(1)?,
        site_id: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        status: row.get(5)?,
        latitude: row.get(6)?,
        longitude: row.get(7)?,
        terrain_elevation_m: row.get(8)?,
        mast_height_m: row.get(9)?,
        antenna_offset_m: row.get(10)?,
        antenna_center_amsl_m: row.get(11)?,
        mast_type: row.get(12)?,
        antenna_type: row.get(13)?,
        equipment_model: row.get(14)?,
        azimuth_deg: row.get(15)?,
        azimuth_ref: row.get(16)?,
        elevation_deg: row.get(17)?,
        tilt_deg: row.get(18)?,
        pan_tilt_status: row.get(19)?,
        equipment_status: row.get(20)?,
        notes: row.get(21)?,
        payload: row.get(22)?,
        created_at: row.get(23)?,
        updated_at: row.get(24)?,
    })
}

#[tauri::command]
pub fn station_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    actor: Option<String>,
    station: StationRow,
) -> Result<StationRow, String> {
    auth_session::require_role_write(&auth)?;
    let actor = auth_session::current_user(&auth).or(actor);
    permissions::require(&state, actor.as_deref(), Permission::ManageDevices)?;
    validate_coords(station.latitude, station.longitude)?;
    let mut s = station;
    s.antenna_center_amsl_m =
        antenna_center_amsl(s.terrain_elevation_m, s.mast_height_m, s.antenna_offset_m);
    if s.status.as_deref().unwrap_or("").is_empty() {
        s.status = Some("unknown".into());
    }
    if s.updated_at.is_empty() {
        s.updated_at = chrono_like_now();
    }
    if s.created_at.as_deref().unwrap_or("").is_empty() {
        s.created_at = Some(s.updated_at.clone());
    }
    if s.payload.is_empty() {
        s.payload = "{}".into();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO stations(
                id, complex_id, site_id, name, description, status, latitude, longitude,
                terrain_elevation_m, mast_height_m, antenna_offset_m, antenna_center_amsl_m,
                mast_type, antenna_type, equipment_model, azimuth_deg, azimuth_ref,
                elevation_deg, tilt_deg, pan_tilt_status, equipment_status, notes,
                payload, created_at, updated_at
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)
             ON CONFLICT(id) DO UPDATE SET
                complex_id=excluded.complex_id, site_id=excluded.site_id, name=excluded.name,
                description=excluded.description, status=excluded.status,
                latitude=excluded.latitude, longitude=excluded.longitude,
                terrain_elevation_m=excluded.terrain_elevation_m,
                mast_height_m=excluded.mast_height_m, antenna_offset_m=excluded.antenna_offset_m,
                antenna_center_amsl_m=excluded.antenna_center_amsl_m,
                mast_type=excluded.mast_type, antenna_type=excluded.antenna_type,
                equipment_model=excluded.equipment_model, azimuth_deg=excluded.azimuth_deg,
                azimuth_ref=excluded.azimuth_ref, elevation_deg=excluded.elevation_deg,
                tilt_deg=excluded.tilt_deg, pan_tilt_status=excluded.pan_tilt_status,
                equipment_status=excluded.equipment_status, notes=excluded.notes,
                payload=excluded.payload, updated_at=excluded.updated_at,
                created_at=COALESCE(stations.created_at, excluded.created_at)",
            params![
                s.id,
                s.complex_id,
                s.site_id,
                s.name,
                s.description,
                s.status,
                s.latitude,
                s.longitude,
                s.terrain_elevation_m,
                s.mast_height_m,
                s.antenna_offset_m,
                s.antenna_center_amsl_m,
                s.mast_type,
                s.antenna_type,
                s.equipment_model,
                s.azimuth_deg,
                s.azimuth_ref,
                s.elevation_deg,
                s.tilt_deg,
                s.pan_tilt_status,
                s.equipment_status,
                s.notes,
                s.payload,
                s.created_at,
                s.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(s)
    })
}

#[tauri::command]
pub fn station_delete(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    actor: Option<String>,
    id: String,
) -> Result<(), String> {
    auth_session::require_role_write(&auth)?;
    let actor = auth_session::current_user(&auth).or(actor);
    permissions::require(&state, actor.as_deref(), Permission::ManageDevices)?;
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM stations WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

#[cfg(test)]
mod tests {
    use super::antenna_center_amsl;

    #[test]
    fn amsl_formula() {
        assert_eq!(
            antenna_center_amsl(Some(180.0), Some(10.0), Some(2.0)),
            Some(192.0)
        );
        assert_eq!(antenna_center_amsl(None, Some(10.0), Some(2.0)), None);
        assert_eq!(antenna_center_amsl(Some(180.0), None, Some(2.0)), None);
        assert_eq!(
            antenna_center_amsl(Some(100.0), Some(5.0), None),
            Some(105.0)
        );
    }
}
