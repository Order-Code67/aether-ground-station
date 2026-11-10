//! Terrain / DEM helpers — GeoTIFF detection and source registration metadata.
//! Full elevation sampling from GeoTIFF rasters is staged; missing heights stay N/A.

use serde::Serialize;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use tauri::State;

use crate::auth_session::{self, AuthSessionState};
use crate::database::permissions::{self, Permission};
use crate::database::sqlite::{with_conn, DbState};
use rusqlite::params;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoTiffInfo {
    pub path: String,
    pub valid_tiff: bool,
    pub little_endian: bool,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub message: String,
}

/// Minimal TIFF header + IFD parse for ImageWidth/ImageLength (tags 256/257).
pub fn inspect_geotiff(path: &str) -> Result<GeoTiffInfo, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Файл не найден: {path}"));
    }
    let mut f = File::open(p).map_err(|e| e.to_string())?;
    let mut header = [0u8; 8];
    let n = f.read(&mut header).map_err(|e| e.to_string())?;
    if n < 8 {
        return Ok(GeoTiffInfo {
            path: path.into(),
            valid_tiff: false,
            little_endian: true,
            width: None,
            height: None,
            message: "Файл слишком короткий для TIFF".into(),
        });
    }

    let little = match &header[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => {
            return Ok(GeoTiffInfo {
                path: path.into(),
                valid_tiff: false,
                little_endian: true,
                width: None,
                height: None,
                message: "Не TIFF (ожидается II*\\0 или MM\\0*)".into(),
            });
        }
    };
    let magic = if little {
        u16::from_le_bytes([header[2], header[3]])
    } else {
        u16::from_be_bytes([header[2], header[3]])
    };
    if magic != 42 {
        return Ok(GeoTiffInfo {
            path: path.into(),
            valid_tiff: false,
            little_endian: little,
            width: None,
            height: None,
            message: format!("Неверный TIFF magic: {magic}"),
        });
    }
    let ifd_offset = if little {
        u32::from_le_bytes(header[4..8].try_into().unwrap())
    } else {
        u32::from_be_bytes(header[4..8].try_into().unwrap())
    } as u64;

    f.seek(SeekFrom::Start(ifd_offset)).map_err(|e| e.to_string())?;
    let mut nbuf = [0u8; 2];
    f.read_exact(&mut nbuf).map_err(|e| e.to_string())?;
    let n_entries = if little {
        u16::from_le_bytes(nbuf)
    } else {
        u16::from_be_bytes(nbuf)
    };

    let mut width = None;
    let mut height = None;
    for _ in 0..n_entries {
        let mut entry = [0u8; 12];
        f.read_exact(&mut entry).map_err(|e| e.to_string())?;
        let tag = if little {
            u16::from_le_bytes([entry[0], entry[1]])
        } else {
            u16::from_be_bytes([entry[0], entry[1]])
        };
        let typ = if little {
            u16::from_le_bytes([entry[2], entry[3]])
        } else {
            u16::from_be_bytes([entry[2], entry[3]])
        };
        // value in offset field for SHORT/LONG count=1
        let value = if little {
            u32::from_le_bytes([entry[8], entry[9], entry[10], entry[11]])
        } else {
            u32::from_be_bytes([entry[8], entry[9], entry[10], entry[11]])
        };
        let short_val = if little {
            u16::from_le_bytes([entry[8], entry[9]]) as u32
        } else {
            u16::from_be_bytes([entry[8], entry[9]]) as u32
        };
        let parsed = if typ == 3 { short_val } else { value };
        match tag {
            256 => width = Some(parsed),
            257 => height = Some(parsed),
            _ => {}
        }
    }

    Ok(GeoTiffInfo {
        path: path.into(),
        valid_tiff: true,
        little_endian: little,
        width,
        height,
        message: format!(
            "GeoTIFF/TIFF OK · {}×{}",
            width.map(|v| v.to_string()).unwrap_or("?".into()),
            height.map(|v| v.to_string()).unwrap_or("?".into())
        ),
    })
}

#[tauri::command]
pub fn terrain_inspect_geotiff(path: String) -> Result<GeoTiffInfo, String> {
    inspect_geotiff(&path)
}

#[tauri::command]
pub fn terrain_register_source(
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
    id: String,
    name: String,
    source_type: String,
    path: Option<String>,
    resolution_m: Option<f64>,
) -> Result<(), String> {
    auth_session::require_role_write(&auth)?;
    permissions::require(
        &state,
        auth_session::current_user(&auth).as_deref(),
        Permission::ManageDevices,
    )?;
    let updated = chrono_now();
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO terrain_sources(id, name, source_type, path, resolution_m, payload, updated_at)
             VALUES(?1,?2,?3,?4,?5,'{}',?6)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, source_type=excluded.source_type, path=excluded.path,
               resolution_m=excluded.resolution_m, updated_at=excluded.updated_at",
            params![id, name, source_type, path, resolution_m, updated],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::inspect_geotiff;
    use std::io::Write;
    use std::path::PathBuf;

    #[test]
    fn rejects_non_tiff() {
        let dir = std::env::temp_dir();
        let path = dir.join("ags_not_tiff.bin");
        std::fs::write(&path, b"hello").unwrap();
        let info = inspect_geotiff(path.to_str().unwrap()).unwrap();
        assert!(!info.valid_tiff);
    }

    #[test]
    fn parses_minimal_tiff() {
        // II little-endian, magic 42, IFD at 8, 2 entries: width=4 height=2
        let mut buf = Vec::new();
        buf.extend_from_slice(b"II");
        buf.extend_from_slice(&42u16.to_le_bytes());
        buf.extend_from_slice(&8u32.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        // tag 256 SHORT count 1 value 4
        buf.extend_from_slice(&256u16.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        // tag 257
        buf.extend_from_slice(&257u16.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes()); // next IFD
        let path: PathBuf = std::env::temp_dir().join("ags_min.tif");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(&buf).unwrap();
        let info = inspect_geotiff(path.to_str().unwrap()).unwrap();
        assert!(info.valid_tiff);
        assert_eq!(info.width, Some(4));
        assert_eq!(info.height, Some(2));
    }
}
