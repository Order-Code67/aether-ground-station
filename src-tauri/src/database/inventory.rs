use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::permissions::{self, Permission};
use super::sqlite::{with_conn, DbState};
use crate::auth_session::{self, AuthSessionState};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EquipmentRow {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub status: Option<String>,
    pub location: Option<String>,
    #[serde(default)]
    pub station_id: Option<String>,
    #[serde(default)]
    pub complex_id: Option<String>,
    #[serde(default)]
    pub site_id: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub installed_at: Option<String>,
    pub payload: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaintenanceRow {
    pub id: String,
    pub equipment_id: Option<String>,
    pub due_at: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
    pub payload: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn inventory_list(state: State<'_, DbState>) -> Result<Vec<EquipmentRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, manufacturer, model, serial_number, inventory_number,
                        status, location, payload, updated_at,
                        station_id, complex_id, site_id, category, installed_at
                 FROM equipment_inventory ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(EquipmentRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    manufacturer: row.get(2)?,
                    model: row.get(3)?,
                    serial_number: row.get(4)?,
                    inventory_number: row.get(5)?,
                    status: row.get(6)?,
                    location: row.get(7)?,
                    payload: row.get(8)?,
                    updated_at: row.get(9)?,
                    station_id: row.get(10).ok(),
                    complex_id: row.get(11).ok(),
                    site_id: row.get(12).ok(),
                    category: row.get(13).ok(),
                    installed_at: row.get(14).ok(),
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
pub fn inventory_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: EquipmentRow,
) -> Result<EquipmentRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO equipment_inventory(
                id, name, manufacturer, model, serial_number, inventory_number,
                status, location, payload, updated_at,
                station_id, complex_id, site_id, category, installed_at
             ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, manufacturer=excluded.manufacturer, model=excluded.model,
                serial_number=excluded.serial_number, inventory_number=excluded.inventory_number,
                status=excluded.status, location=excluded.location, payload=excluded.payload,
                updated_at=excluded.updated_at, station_id=excluded.station_id,
                complex_id=excluded.complex_id, site_id=excluded.site_id,
                category=excluded.category, installed_at=excluded.installed_at",
            params![
                item.id,
                item.name,
                item.manufacturer,
                item.model,
                item.serial_number,
                item.inventory_number,
                item.status,
                item.location,
                item.payload,
                item.updated_at,
                item.station_id,
                item.complex_id,
                item.site_id,
                item.category,
                item.installed_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[tauri::command]
pub fn maintenance_list(state: State<'_, DbState>) -> Result<Vec<MaintenanceRow>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, equipment_id, due_at, status, notes, payload, updated_at
                 FROM maintenance_records ORDER BY due_at IS NULL, due_at",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(MaintenanceRow {
                    id: row.get(0)?,
                    equipment_id: row.get(1)?,
                    due_at: row.get(2)?,
                    status: row.get(3)?,
                    notes: row.get(4)?,
                    payload: row.get(5)?,
                    updated_at: row.get(6)?,
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
pub fn maintenance_upsert(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    item: MaintenanceRow,
) -> Result<MaintenanceRow, String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO maintenance_records(
                id, equipment_id, due_at, status, notes, payload, updated_at
             ) VALUES(?1,?2,?3,?4,?5,?6,?7)
             ON CONFLICT(id) DO UPDATE SET
                equipment_id=excluded.equipment_id, due_at=excluded.due_at,
                status=excluded.status, notes=excluded.notes, payload=excluded.payload,
                updated_at=excluded.updated_at",
            params![
                item.id,
                item.equipment_id,
                item.due_at,
                item.status,
                item.notes,
                item.payload,
                item.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(item)
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryRow {
    pub id: String,
    pub device_id: Option<String>,
    pub at: String,
    pub payload: String,
}

#[tauri::command]
pub fn telemetry_append(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    id: String,
    device_id: Option<String>,
    at: String,
    payload: String,
) -> Result<(), String> {
    auth_session::require_role_write(&auth)?;
    let _: serde_json::Value =
        serde_json::from_str(&payload).map_err(|e| format!("Неверный JSON: {e}"))?;
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO telemetry_records(id, device_id, at, payload) VALUES(?1,?2,?3,?4)",
            params![id, device_id, at, payload],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn telemetry_list(
    state: State<'_, DbState>,
    limit: Option<i64>,
) -> Result<Vec<TelemetryRow>, String> {
    let lim = limit.unwrap_or(200).clamp(1, 1000);
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, device_id, at, payload FROM telemetry_records
                 ORDER BY at DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![lim], |row| {
                Ok(TelemetryRow {
                    id: row.get(0)?,
                    device_id: row.get(1)?,
                    at: row.get(2)?,
                    payload: row.get(3)?,
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
pub fn report_complex_summary(state: State<'_, DbState>) -> Result<String, String> {
    with_conn(&state, |conn| {
        let stations: i64 = conn
            .query_row("SELECT COUNT(*) FROM stations", [], |r| r.get(0))
            .unwrap_or(0);
        let devices: i64 = conn
            .query_row("SELECT COUNT(*) FROM devices", [], |r| r.get(0))
            .unwrap_or(0);
        let equipment: i64 = conn
            .query_row("SELECT COUNT(*) FROM equipment_inventory", [], |r| r.get(0))
            .unwrap_or(0);
        let maintenance_open: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM maintenance_records WHERE status IS NULL OR status!='done'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let events: i64 = conn
            .query_row("SELECT COUNT(*) FROM event_log", [], |r| r.get(0))
            .unwrap_or(0);
        let report = serde_json::json!({
            "generatedAt": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            "stations": stations,
            "devices": devices,
            "equipment": equipment,
            "maintenanceOpen": maintenance_open,
            "events": events,
        });
        Ok(serde_json::to_string_pretty(&report).unwrap_or_else(|_| "{}".into()))
    })
}
