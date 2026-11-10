use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::permissions::{self, Permission};
use super::sqlite::{with_conn, DbState};

/// Antenna Center AMSL = Terrain Elevation + Mast Height + Antenna Offset.
pub fn antenna_center_amsl(
    terrain_elevation_m: Option<f64>,
    mast_height_m: f64,
    antenna_offset_m: f64,
) -> Option<f64> {
    terrain_elevation_m.map(|e| e + mast_height_m + antenna_offset_m)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StationRow {
    pub id: String,
    pub complex_id: Option<String>,
    pub site_id: Option<String>,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub terrain_elevation_m: Option<f64>,
    pub mast_height_m: f64,
    pub antenna_offset_m: f64,
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
    pub updated_at: String,
}

#[tauri::command]
pub fn station_list(state: State<'_, DbState>) -> Result<Vec<StationRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, complex_id, site_id, name, latitude, longitude,
                        terrain_elevation_m, mast_height_m, antenna_offset_m, antenna_center_amsl_m,
                        mast_type, antenna_type, equipment_model, azimuth_deg, azimuth_ref,
                        elevation_deg, tilt_deg, pan_tilt_status, equipment_status, notes,
                        payload, updated_at
                 FROM stations ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], map_station)
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}

fn map_station(row: &rusqlite::Row<'_>) -> rusqlite::Result<StationRow> {
    Ok(StationRow {
        id: row.get(0)?,
        complex_id: row.get(1)?,
        site_id: row.get(2)?,
        name: row.get(3)?,
        latitude: row.get(4)?,
        longitude: row.get(5)?,
        terrain_elevation_m: row.get(6)?,
        mast_height_m: row.get(7)?,
        antenna_offset_m: row.get(8)?,
        antenna_center_amsl_m: row.get(9)?,
        mast_type: row.get(10)?,
        antenna_type: row.get(11)?,
        equipment_model: row.get(12)?,
        azimuth_deg: row.get(13)?,
        azimuth_ref: row.get(14)?,
        elevation_deg: row.get(15)?,
        tilt_deg: row.get(16)?,
        pan_tilt_status: row.get(17)?,
        equipment_status: row.get(18)?,
        notes: row.get(19)?,
        payload: row.get(20)?,
        updated_at: row.get(21)?,
    })
}

#[tauri::command]
pub fn station_upsert(
    state: State<'_, DbState>,
    actor: Option<String>,
    station: StationRow,
) -> Result<StationRow, String> {
    permissions::require(&state, actor.as_deref(), Permission::ManageDevices)?;
    let mut s = station;
    s.antenna_center_amsl_m = antenna_center_amsl(
        s.terrain_elevation_m,
        s.mast_height_m,
        s.antenna_offset_m,
    );
    if s.updated_at.is_empty() {
        s.updated_at = chrono_like_now();
    }
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO stations(
                id, complex_id, site_id, name, latitude, longitude,
                terrain_elevation_m, mast_height_m, antenna_offset_m, antenna_center_amsl_m,
                mast_type, antenna_type, equipment_model, azimuth_deg, azimuth_ref,
                elevation_deg, tilt_deg, pan_tilt_status, equipment_status, notes,
                payload, updated_at
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)
             ON CONFLICT(id) DO UPDATE SET
                complex_id=excluded.complex_id, site_id=excluded.site_id, name=excluded.name,
                latitude=excluded.latitude, longitude=excluded.longitude,
                terrain_elevation_m=excluded.terrain_elevation_m,
                mast_height_m=excluded.mast_height_m, antenna_offset_m=excluded.antenna_offset_m,
                antenna_center_amsl_m=excluded.antenna_center_amsl_m,
                mast_type=excluded.mast_type, antenna_type=excluded.antenna_type,
                equipment_model=excluded.equipment_model, azimuth_deg=excluded.azimuth_deg,
                azimuth_ref=excluded.azimuth_ref, elevation_deg=excluded.elevation_deg,
                tilt_deg=excluded.tilt_deg, pan_tilt_status=excluded.pan_tilt_status,
                equipment_status=excluded.equipment_status, notes=excluded.notes,
                payload=excluded.payload, updated_at=excluded.updated_at",
            params![
                s.id,
                s.complex_id,
                s.site_id,
                s.name,
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
    actor: Option<String>,
    id: String,
) -> Result<(), String> {
    permissions::require(&state, actor.as_deref(), Permission::ManageDevices)?;
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM stations WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })
}

fn chrono_like_now() -> String {
    // Avoid extra chrono dep — ISO-ish UTC from system
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
        assert_eq!(antenna_center_amsl(Some(180.0), 10.0, 2.0), Some(192.0));
        assert_eq!(antenna_center_amsl(None, 10.0, 2.0), None);
    }
}
