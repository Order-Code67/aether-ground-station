use rusqlite::{params, Connection};

/// Versioned migrations. Current schema version = 4 (outbox attempts/failed).
pub const SCHEMA_VERSION: i64 = 4;

pub fn apply_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )
    .map_err(|e| e.to_string())?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        migrate_v1(conn)?;
        stamp(conn, 1)?;
    }
    if current < 2 {
        migrate_v2(conn)?;
        stamp(conn, 2)?;
    }
    if current < 3 {
        migrate_v3(conn)?;
        stamp(conn, 3)?;
    }
    if current < 4 {
        migrate_v4(conn)?;
        stamp(conn, 4)?;
    }

    // Ensure foreign keys on for this connection
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    let _ = SCHEMA_VERSION;
    Ok(())
}

fn stamp(conn: &Connection, version: i64) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?1, datetime('now'))",
        params![version],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspace_layouts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          profile_id TEXT,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS event_log (
          id TEXT PRIMARY KEY,
          at TEXT NOT NULL,
          severity TEXT NOT NULL,
          source TEXT NOT NULL,
          message TEXT NOT NULL,
          details TEXT
        );
        CREATE TABLE IF NOT EXISTS archive_clips (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings_kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          manufacturer TEXT,
          model TEXT,
          device_type TEXT,
          connection_type TEXT,
          configuration TEXT,
          status TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS video_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          configuration TEXT NOT NULL,
          status TEXT
        );
        CREATE TABLE IF NOT EXISTS recordings (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          filename TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          metadata TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          disabled INTEGER NOT NULL DEFAULT 0,
          configuration TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          timestamp TEXT NOT NULL,
          event TEXT NOT NULL,
          details TEXT
        );
        CREATE TABLE IF NOT EXISTS kv_json (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_event_log_at ON event_log(at DESC);
        CREATE INDEX IF NOT EXISTS idx_recordings_start ON recordings(start_time DESC);
        CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
        "#,
    )
    .map_err(|e| e.to_string())
}

fn migrate_v2(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS complexes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'unknown',
          region TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS station_sites (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          description TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stations (
          id TEXT PRIMARY KEY,
          complex_id TEXT,
          site_id TEXT,
          name TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          terrain_elevation_m REAL,
          mast_height_m REAL NOT NULL DEFAULT 0,
          antenna_offset_m REAL NOT NULL DEFAULT 0,
          antenna_center_amsl_m REAL,
          mast_type TEXT,
          antenna_type TEXT,
          equipment_model TEXT,
          azimuth_deg REAL,
          azimuth_ref TEXT DEFAULT 'true',
          elevation_deg REAL,
          tilt_deg REAL,
          pan_tilt_status TEXT,
          equipment_status TEXT,
          notes TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL,
          FOREIGN KEY(complex_id) REFERENCES complexes(id) ON DELETE SET NULL,
          FOREIGN KEY(site_id) REFERENCES station_sites(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS mast_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          mast_type TEXT NOT NULL,
          height_m REAL NOT NULL,
          sections INTEGER,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS antenna_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          manufacturer TEXT,
          model TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS terrain_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          path TEXT,
          resolution_m REAL,
          vertical_datum TEXT,
          coverage TEXT,
          uncertainty_m REAL,
          acquired_at TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS terrain_profiles (
          id TEXT PRIMARY KEY,
          station_id TEXT,
          name TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS telemetry_records (
          id TEXT PRIMARY KEY,
          device_id TEXT,
          at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS network_nodes (
          id TEXT PRIMARY KEY,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          protocol TEXT,
          status TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS equipment_inventory (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          manufacturer TEXT,
          model TEXT,
          serial_number TEXT,
          inventory_number TEXT,
          status TEXT,
          location TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS maintenance_records (
          id TEXT PRIMARY KEY,
          equipment_id TEXT,
          due_at TEXT,
          status TEXT,
          notes TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL,
          FOREIGN KEY(equipment_id) REFERENCES equipment_inventory(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS diagnostic_reports (
          id TEXT PRIMARY KEY,
          at TEXT NOT NULL,
          module TEXT NOT NULL,
          component TEXT,
          code TEXT,
          severity TEXT NOT NULL,
          description TEXT NOT NULL,
          context TEXT,
          remediation TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_stations_complex ON stations(complex_id);
        CREATE INDEX IF NOT EXISTS idx_stations_coords ON stations(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_telemetry_at ON telemetry_records(at DESC);
        CREATE INDEX IF NOT EXISTS idx_diag_at ON diagnostic_reports(at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp DESC);
        "#,
    )
    .map_err(|e| e.to_string())
}

fn migrate_v3(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status ON sync_outbox(status, created_at);
        "#,
    )
    .map_err(|e| e.to_string())
}

fn migrate_v4(conn: &Connection) -> Result<(), String> {
    // Best-effort ALTER — columns may already exist on re-run of incomplete upgrades.
    let _ = conn.execute(
        "ALTER TABLE sync_outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0",
        [],
    );
    let _ = conn.execute("ALTER TABLE sync_outbox ADD COLUMN last_error TEXT", []);
    Ok(())
}
