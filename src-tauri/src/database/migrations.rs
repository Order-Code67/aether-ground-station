use rusqlite::{params, Connection};

/// Versioned migrations. Current schema version = 5 (GS-2 complex/site + mounts).
pub const SCHEMA_VERSION: i64 = 5;

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
    if current < 5 {
        migrate_v5(conn)?;
        stamp(conn, 5)?;
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

/// GS-2/4: site↔complex, nullable mast, station meta, antenna mounts, scenarios, equipment links.
fn migrate_v5(conn: &Connection) -> Result<(), String> {
    let _ = conn.execute("ALTER TABLE station_sites ADD COLUMN complex_id TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE station_sites ADD COLUMN status TEXT NOT NULL DEFAULT 'unknown'",
        [],
    );
    let _ = conn.execute("ALTER TABLE station_sites ADD COLUMN address TEXT", []);
    let _ = conn.execute("ALTER TABLE station_sites ADD COLUMN created_at TEXT", []);
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sites_complex ON station_sites(complex_id)",
        [],
    );

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS stations_v5 (
          id TEXT PRIMARY KEY,
          complex_id TEXT,
          site_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'unknown',
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          terrain_elevation_m REAL,
          mast_height_m REAL,
          antenna_offset_m REAL,
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
          created_at TEXT,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(complex_id) REFERENCES complexes(id) ON DELETE SET NULL,
          FOREIGN KEY(site_id) REFERENCES station_sites(id) ON DELETE SET NULL
        );
        INSERT OR IGNORE INTO stations_v5(
          id, complex_id, site_id, name, description, status, latitude, longitude,
          terrain_elevation_m, mast_height_m, antenna_offset_m, antenna_center_amsl_m,
          mast_type, antenna_type, equipment_model, azimuth_deg, azimuth_ref,
          elevation_deg, tilt_deg, pan_tilt_status, equipment_status, notes,
          payload, created_at, updated_at
        )
        SELECT
          id, complex_id, site_id, name, NULL, 'unknown', latitude, longitude,
          terrain_elevation_m, mast_height_m, antenna_offset_m, antenna_center_amsl_m,
          mast_type, antenna_type, equipment_model, azimuth_deg, azimuth_ref,
          elevation_deg, tilt_deg, pan_tilt_status, equipment_status, notes,
          payload, updated_at, updated_at
        FROM stations;
        DROP TABLE stations;
        ALTER TABLE stations_v5 RENAME TO stations;
        CREATE INDEX IF NOT EXISTS idx_stations_complex ON stations(complex_id);
        CREATE INDEX IF NOT EXISTS idx_stations_site ON stations(site_id);
        CREATE INDEX IF NOT EXISTS idx_stations_coords ON stations(latitude, longitude);

        CREATE TABLE IF NOT EXISTS station_antenna_mounts (
          id TEXT PRIMARY KEY,
          station_id TEXT NOT NULL,
          antenna_profile_id TEXT,
          label TEXT,
          mount_height_m REAL,
          azimuth_deg REAL,
          elevation_deg REAL,
          tilt_deg REAL,
          azimuth_source TEXT,
          updated_at TEXT NOT NULL,
          payload TEXT NOT NULL DEFAULT '{}',
          FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE,
          FOREIGN KEY(antenna_profile_id) REFERENCES antenna_profiles(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_mounts_station ON station_antenna_mounts(station_id);

        CREATE TABLE IF NOT EXISTS station_placement_scenarios (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          complex_id TEXT,
          payload TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL,
          FOREIGN KEY(complex_id) REFERENCES complexes(id) ON DELETE SET NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;

    for sql in [
        "ALTER TABLE mast_profiles ADD COLUMN manufacturer TEXT",
        "ALTER TABLE mast_profiles ADD COLUMN model TEXT",
        "ALTER TABLE mast_profiles ADD COLUMN mount_point_height_m REAL",
        "ALTER TABLE mast_profiles ADD COLUMN levels INTEGER",
        "ALTER TABLE antenna_profiles ADD COLUMN antenna_type TEXT",
        "ALTER TABLE antenna_profiles ADD COLUMN frequency_range TEXT",
        "ALTER TABLE antenna_profiles ADD COLUMN polarization TEXT",
        "ALTER TABLE antenna_profiles ADD COLUMN gain_dbi REAL",
        "ALTER TABLE antenna_profiles ADD COLUMN beamwidth_deg REAL",
        "ALTER TABLE antenna_profiles ADD COLUMN connector TEXT",
        "ALTER TABLE antenna_profiles ADD COLUMN mass_kg REAL",
        "ALTER TABLE antenna_profiles ADD COLUMN dimensions TEXT",
        "ALTER TABLE equipment_inventory ADD COLUMN station_id TEXT",
        "ALTER TABLE equipment_inventory ADD COLUMN complex_id TEXT",
        "ALTER TABLE equipment_inventory ADD COLUMN site_id TEXT",
        "ALTER TABLE equipment_inventory ADD COLUMN category TEXT",
        "ALTER TABLE equipment_inventory ADD COLUMN installed_at TEXT",
    ] {
        let _ = conn.execute(sql, []);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{apply_migrations, SCHEMA_VERSION};
    use rusqlite::Connection;

    #[test]
    fn migrations_apply_to_v5() {
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).expect("migrate");
        let v: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(v, SCHEMA_VERSION);
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name='station_antenna_mounts'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }
}
