//! Terrain / DEM — GeoTIFF inspect + elevation sampling for uncompressed rasters.
//! Missing / unsupported formats → elevation null (N/A), never invented.

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
    pub bits_per_sample: Option<u16>,
    pub sample_format: Option<u16>,
    pub compression: Option<u16>,
    pub has_geo_tags: bool,
    pub message: String,
}

#[derive(Debug, Clone)]
struct TiffRaster {
    little: bool,
    width: u32,
    height: u32,
    bits_per_sample: u16,
    sample_format: u16, // 1=uint 2=int 3=float
    compression: u16,
    rows_per_strip: u32,
    strip_offsets: Vec<u64>,
    strip_byte_counts: Vec<u64>,
    tile_width: Option<u32>,
    tile_height: Option<u32>,
    tile_offsets: Vec<u64>,
    tile_byte_counts: Vec<u64>,
    // Geo: pixel scale + tiepoint origin (lon/lat typically)
    scale_x: Option<f64>,
    scale_y: Option<f64>,
    origin_x: Option<f64>,
    origin_y: Option<f64>,
}

fn read_u16(buf: &[u8], little: bool) -> u16 {
    if little {
        u16::from_le_bytes([buf[0], buf[1]])
    } else {
        u16::from_be_bytes([buf[0], buf[1]])
    }
}

fn read_u32(buf: &[u8], little: bool) -> u32 {
    if little {
        u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]])
    } else {
        u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]])
    }
}

fn read_f64(buf: &[u8], little: bool) -> f64 {
    let b: [u8; 8] = buf.try_into().unwrap();
    if little {
        f64::from_le_bytes(b)
    } else {
        f64::from_be_bytes(b)
    }
}

fn type_size(typ: u16) -> u32 {
    match typ {
        1 | 2 => 1, // BYTE / ASCII
        3 => 2,     // SHORT
        4 => 4,     // LONG
        5 => 8,     // RATIONAL
        11 => 4,    // FLOAT
        12 => 8,    // DOUBLE
        _ => 1,
    }
}

fn read_tag_values(
    f: &mut File,
    little: bool,
    typ: u16,
    count: u32,
    offset_or_value: [u8; 4],
) -> Result<Vec<u8>, String> {
    let size = type_size(typ).saturating_mul(count);
    if size <= 4 {
        Ok(offset_or_value[..size as usize].to_vec())
    } else {
        let off = read_u32(&offset_or_value, little) as u64;
        f.seek(SeekFrom::Start(off)).map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; size as usize];
        f.read_exact(&mut buf).map_err(|e| e.to_string())?;
        Ok(buf)
    }
}

fn parse_raster(path: &str) -> Result<(GeoTiffInfo, Option<TiffRaster>), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Файл не найден: {path}"));
    }
    let mut f = File::open(p).map_err(|e| e.to_string())?;
    let mut header = [0u8; 8];
    let n = f.read(&mut header).map_err(|e| e.to_string())?;
    if n < 8 {
        return Ok((
            GeoTiffInfo {
                path: path.into(),
                valid_tiff: false,
                little_endian: true,
                width: None,
                height: None,
                bits_per_sample: None,
                sample_format: None,
                compression: None,
                has_geo_tags: false,
                message: "Файл слишком короткий для TIFF".into(),
            },
            None,
        ));
    }

    let little = match &header[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => {
            return Ok((
                GeoTiffInfo {
                    path: path.into(),
                    valid_tiff: false,
                    little_endian: true,
                    width: None,
                    height: None,
                    bits_per_sample: None,
                    sample_format: None,
                    compression: None,
                    has_geo_tags: false,
                    message: "Не TIFF (ожидается II*\\0 или MM\\0*)".into(),
                },
                None,
            ));
        }
    };
    let magic = read_u16(&header[2..4], little);
    if magic != 42 {
        return Ok((
            GeoTiffInfo {
                path: path.into(),
                valid_tiff: false,
                little_endian: little,
                width: None,
                height: None,
                bits_per_sample: None,
                sample_format: None,
                compression: None,
                has_geo_tags: false,
                message: format!("Неверный TIFF magic: {magic}"),
            },
            None,
        ));
    }
    drop(f);
    let raster = parse_ifd(path, little)?;
    let has_geo = raster
        .as_ref()
        .map(|r| r.scale_x.is_some() && r.origin_x.is_some())
        .unwrap_or(false);
    let info = GeoTiffInfo {
        path: path.into(),
        valid_tiff: true,
        little_endian: little,
        width: raster.as_ref().map(|r| r.width),
        height: raster.as_ref().map(|r| r.height),
        bits_per_sample: raster.as_ref().map(|r| r.bits_per_sample),
        sample_format: raster.as_ref().map(|r| r.sample_format),
        compression: raster.as_ref().map(|r| r.compression),
        has_geo_tags: has_geo,
        message: format!(
            "GeoTIFF/TIFF OK · {}×{} · geo={} · compression={}",
            raster.as_ref().map(|r| r.width.to_string()).unwrap_or("?".into()),
            raster
                .as_ref()
                .map(|r| r.height.to_string())
                .unwrap_or("?".into()),
            has_geo,
            raster.as_ref().map(|r| r.compression).unwrap_or(0)
        ),
    };
    Ok((info, raster))
}

fn parse_ifd(path: &str, little: bool) -> Result<Option<TiffRaster>, String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    let mut header = [0u8; 8];
    f.read_exact(&mut header).map_err(|e| e.to_string())?;
    let ifd_offset = read_u32(&header[4..8], little) as u64;
    f.seek(SeekFrom::Start(ifd_offset)).map_err(|e| e.to_string())?;
    let mut nbuf = [0u8; 2];
    f.read_exact(&mut nbuf).map_err(|e| e.to_string())?;
    let n_entries = read_u16(&nbuf, little);

    let mut width = 0u32;
    let mut height = 0u32;
    let mut bits_per_sample = 16u16;
    let mut sample_format = 1u16;
    let mut compression = 1u16;
    let mut rows_per_strip = u32::MAX;
    let mut strip_offsets = Vec::new();
    let mut strip_byte_counts = Vec::new();
    let mut tile_width = None;
    let mut tile_height = None;
    let mut tile_offsets = Vec::new();
    let mut tile_byte_counts = Vec::new();
    let mut scale_x = None;
    let mut scale_y = None;
    let mut origin_x = None;
    let mut origin_y = None;

    // Collect entries first (12 bytes each) so value reads don't scramble IFD cursor.
    let mut entries = Vec::with_capacity(n_entries as usize);
    for _ in 0..n_entries {
        let mut entry = [0u8; 12];
        f.read_exact(&mut entry).map_err(|e| e.to_string())?;
        entries.push(entry);
    }

    for entry in &entries {
        let tag = read_u16(&entry[0..2], little);
        let typ = read_u16(&entry[2..4], little);
        let count = read_u32(&entry[4..8], little);
        let val = [entry[8], entry[9], entry[10], entry[11]];
        match tag {
            256 => {
                width = if typ == 3 {
                    read_u16(&val[0..2], little) as u32
                } else {
                    read_u32(&val, little)
                };
            }
            257 => {
                height = if typ == 3 {
                    read_u16(&val[0..2], little) as u32
                } else {
                    read_u32(&val, little)
                };
            }
            258 => bits_per_sample = read_u16(&val[0..2], little),
            259 => compression = read_u16(&val[0..2], little),
            273 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                strip_offsets = decode_u64_list(&raw, little, typ, count);
            }
            278 => {
                rows_per_strip = if typ == 3 {
                    read_u16(&val[0..2], little) as u32
                } else {
                    read_u32(&val, little)
                };
            }
            279 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                strip_byte_counts = decode_u64_list(&raw, little, typ, count);
            }
            322 => {
                tile_width = Some(if typ == 3 {
                    read_u16(&val[0..2], little) as u32
                } else {
                    read_u32(&val, little)
                });
            }
            323 => {
                tile_height = Some(if typ == 3 {
                    read_u16(&val[0..2], little) as u32
                } else {
                    read_u32(&val, little)
                });
            }
            324 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                tile_offsets = decode_u64_list(&raw, little, typ, count);
            }
            325 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                tile_byte_counts = decode_u64_list(&raw, little, typ, count);
            }
            339 => sample_format = read_u16(&val[0..2], little),
            33550 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                if raw.len() >= 24 {
                    scale_x = Some(read_f64(&raw[0..8], little));
                    scale_y = Some(read_f64(&raw[8..16], little));
                }
            }
            33922 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                // I,J,K,X,Y,Z — use first tiepoint
                if raw.len() >= 48 {
                    origin_x = Some(read_f64(&raw[24..32], little));
                    origin_y = Some(read_f64(&raw[32..40], little));
                }
            }
            _ => {}
        }
    }

    if width == 0 || height == 0 {
        return Ok(None);
    }
    if strip_byte_counts.is_empty() {
        strip_byte_counts = vec![0; strip_offsets.len()];
    }
    if rows_per_strip == 0 {
        rows_per_strip = height;
    }

    Ok(Some(TiffRaster {
        little,
        width,
        height,
        bits_per_sample,
        sample_format,
        compression,
        rows_per_strip,
        strip_offsets,
        strip_byte_counts,
        tile_width,
        tile_height,
        tile_offsets,
        tile_byte_counts,
        scale_x,
        scale_y,
        origin_x,
        origin_y,
    }))
}

fn decode_u64_list(raw: &[u8], little: bool, typ: u16, count: u32) -> Vec<u64> {
    let mut out = Vec::with_capacity(count as usize);
    match typ {
        3 => {
            for i in 0..count as usize {
                let o = i * 2;
                if o + 2 <= raw.len() {
                    out.push(read_u16(&raw[o..o + 2], little) as u64);
                }
            }
        }
        4 => {
            for i in 0..count as usize {
                let o = i * 4;
                if o + 4 <= raw.len() {
                    out.push(read_u32(&raw[o..o + 4], little) as u64);
                }
            }
        }
        16 => {
            // LONG8
            for i in 0..count as usize {
                let o = i * 8;
                if o + 8 <= raw.len() {
                    let b: [u8; 8] = raw[o..o + 8].try_into().unwrap();
                    out.push(if little {
                        u64::from_le_bytes(b)
                    } else {
                        u64::from_be_bytes(b)
                    });
                }
            }
        }
        _ => {
            for i in 0..count as usize {
                let o = i * 4;
                if o + 4 <= raw.len() {
                    out.push(read_u32(&raw[o..o + 4], little) as u64);
                }
            }
        }
    }
    out
}

/// Minimal TIFF header + IFD parse for ImageWidth/ImageLength (tags 256/257).
pub fn inspect_geotiff(path: &str) -> Result<GeoTiffInfo, String> {
    Ok(parse_raster(path)?.0)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevationSample {
    pub path: String,
    pub latitude: f64,
    pub longitude: f64,
    pub elevation_m: Option<f64>,
    pub missing: bool,
    pub message: String,
}

fn decode_sample(raster: &TiffRaster, buf: &[u8]) -> Result<Option<f64>, String> {
    match (raster.bits_per_sample, raster.sample_format) {
        (32, 3) => {
            let b: [u8; 4] = buf[..4].try_into().unwrap();
            let f32v = if raster.little {
                f32::from_le_bytes(b)
            } else {
                f32::from_be_bytes(b)
            };
            if !f32v.is_finite() || f32v < -1000.0 || f32v > 9000.0 {
                return Ok(None);
            }
            Ok(Some(f32v as f64))
        }
        (16, 2) => {
            let b: [u8; 2] = buf[..2].try_into().unwrap();
            let i = if raster.little {
                i16::from_le_bytes(b)
            } else {
                i16::from_be_bytes(b)
            };
            if i == i16::MIN || i <= -9999 {
                return Ok(None);
            }
            Ok(Some(i as f64))
        }
        (16, 1) => {
            let b: [u8; 2] = buf[..2].try_into().unwrap();
            let u = if raster.little {
                u16::from_le_bytes(b)
            } else {
                u16::from_be_bytes(b)
            };
            if u == 0 || u == u16::MAX {
                return Ok(None);
            }
            Ok(Some(u as f64))
        }
        (32, 1) | (32, 2) => {
            let b: [u8; 4] = buf[..4].try_into().unwrap();
            let i = if raster.little {
                i32::from_le_bytes(b)
            } else {
                i32::from_be_bytes(b)
            };
            if i <= -9999 {
                return Ok(None);
            }
            Ok(Some(i as f64))
        }
        _ => Err(format!(
            "Формат sample bits={} format={} не поддерживается",
            raster.bits_per_sample, raster.sample_format
        )),
    }
}

fn inflate_if_needed(compression: u16, raw: &[u8]) -> Result<Vec<u8>, String> {
    match compression {
        1 => Ok(raw.to_vec()),
        8 | 32946 => {
            use flate2::read::{DeflateDecoder, ZlibDecoder};
            use std::io::Read as _;
            // Try zlib wrapper first, then raw deflate (Adobe).
            let mut out = Vec::new();
            if ZlibDecoder::new(raw).read_to_end(&mut out).is_ok() && !out.is_empty() {
                return Ok(out);
            }
            out.clear();
            DeflateDecoder::new(raw)
                .read_to_end(&mut out)
                .map_err(|e| format!("Deflate decode: {e}"))?;
            Ok(out)
        }
        other => Err(format!(
            "Сжатие TIFF {other} не поддерживается (1=none, 8=deflate). Высота N/A."
        )),
    }
}

fn sample_pixel(raster: &TiffRaster, path: &str, col: u32, row: u32) -> Result<Option<f64>, String> {
    if col >= raster.width || row >= raster.height {
        return Ok(None);
    }
    let bytes_pp = (raster.bits_per_sample / 8).max(1) as usize;

    // Tiled path
    if let (Some(tw), Some(th)) = (raster.tile_width, raster.tile_height) {
        if tw == 0 || th == 0 || raster.tile_offsets.is_empty() {
            return Ok(None);
        }
        let tiles_across = (raster.width + tw - 1) / tw;
        let tile_col = col / tw;
        let tile_row = row / th;
        let tile_index = (tile_row * tiles_across + tile_col) as usize;
        if tile_index >= raster.tile_offsets.len() {
            return Ok(None);
        }
        let off = raster.tile_offsets[tile_index];
        let nbytes = raster
            .tile_byte_counts
            .get(tile_index)
            .copied()
            .unwrap_or(0) as usize;
        if nbytes == 0 {
            return Ok(None);
        }
        let mut f = File::open(path).map_err(|e| e.to_string())?;
        f.seek(SeekFrom::Start(off)).map_err(|e| e.to_string())?;
        let mut raw = vec![0u8; nbytes];
        f.read_exact(&mut raw).map_err(|e| e.to_string())?;
        let data = inflate_if_needed(raster.compression, &raw)?;
        let x = (col % tw) as usize;
        let y = (row % th) as usize;
        let idx = (y * tw as usize + x) * bytes_pp;
        if idx + bytes_pp > data.len() {
            return Ok(None);
        }
        return decode_sample(raster, &data[idx..idx + bytes_pp]);
    }

    // Strip path
    let strip_index = (row / raster.rows_per_strip) as usize;
    if strip_index >= raster.strip_offsets.len() {
        return Ok(None);
    }
    let row_in_strip = row % raster.rows_per_strip;
    let mut f = File::open(path).map_err(|e| e.to_string())?;

    if raster.compression == 1 {
        let offset = raster.strip_offsets[strip_index]
            + (row_in_strip as u64) * (raster.width as u64) * bytes_pp as u64
            + (col as u64) * bytes_pp as u64;
        f.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; bytes_pp];
        if f.read_exact(&mut buf).is_err() {
            return Ok(None);
        }
        return decode_sample(raster, &buf);
    }

    let nbytes = raster
        .strip_byte_counts
        .get(strip_index)
        .copied()
        .unwrap_or(0) as usize;
    if nbytes == 0 {
        return Ok(None);
    }
    f.seek(SeekFrom::Start(raster.strip_offsets[strip_index]))
        .map_err(|e| e.to_string())?;
    let mut raw = vec![0u8; nbytes];
    f.read_exact(&mut raw).map_err(|e| e.to_string())?;
    let data = inflate_if_needed(raster.compression, &raw)?;
    let idx = (row_in_strip as usize * raster.width as usize + col as usize) * bytes_pp;
    if idx + bytes_pp > data.len() {
        return Ok(None);
    }
    decode_sample(raster, &data[idx..idx + bytes_pp])
}

pub fn sample_elevation(path: &str, latitude: f64, longitude: f64) -> Result<ElevationSample, String> {
    let (info, raster_opt) = parse_raster(path)?;
    if !info.valid_tiff {
        return Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: info.message,
        });
    }
    let Some(raster) = raster_opt else {
        return Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: "Не удалось разобрать raster IFD".into(),
        });
    };
    let (Some(sx), Some(sy), Some(ox), Some(oy)) =
        (raster.scale_x, raster.scale_y, raster.origin_x, raster.origin_y)
    else {
        return Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: "Нет GeoTIFF тегов ModelPixelScale/ModelTiepoint — высота N/A".into(),
        });
    };
    if sx.abs() < 1e-15 || sy.abs() < 1e-15 {
        return Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: "Некорректный pixel scale".into(),
        });
    }
    // Geographic CRS convention: X=lon east, Y=lat north; scale_y often positive magnitude southward in file
    let col_f = (longitude - ox) / sx;
    let row_f = (oy - latitude) / sy.abs();
    if col_f < 0.0 || row_f < 0.0 {
        return Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: "Точка вне растра".into(),
        });
    }
    let col = col_f.floor() as u32;
    let row = row_f.floor() as u32;
    match sample_pixel(&raster, path, col, row) {
        Ok(Some(elev)) => Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: Some(elev),
            missing: false,
            message: format!("elevation={elev:.2} m @ pixel {col},{row}"),
        }),
        Ok(None) => Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: "Nodata / вне покрытия".into(),
        }),
        Err(e) => Ok(ElevationSample {
            path: path.into(),
            latitude,
            longitude,
            elevation_m: None,
            missing: true,
            message: e,
        }),
    }
}

#[tauri::command]
pub fn terrain_inspect_geotiff(path: String) -> Result<GeoTiffInfo, String> {
    inspect_geotiff(&path)
}

#[tauri::command]
pub fn terrain_sample_elevation(
    path: String,
    latitude: f64,
    longitude: f64,
) -> Result<ElevationSample, String> {
    sample_elevation(&path, latitude, longitude)
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
    use super::{inspect_geotiff, sample_elevation};
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
        let mut buf = Vec::new();
        buf.extend_from_slice(b"II");
        buf.extend_from_slice(&42u16.to_le_bytes());
        buf.extend_from_slice(&8u32.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&256u16.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&257u16.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        let path: PathBuf = std::env::temp_dir().join("ags_min.tif");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(&buf).unwrap();
        let info = inspect_geotiff(path.to_str().unwrap()).unwrap();
        assert!(info.valid_tiff);
        assert_eq!(info.width, Some(4));
        assert_eq!(info.height, Some(2));
    }

    #[test]
    fn samples_uncompressed_float_geotiff() {
        let path = write_test_float_geotiff(false, false);
        let s = sample_elevation(path.to_str().unwrap(), 49.995, 30.005).unwrap();
        assert!(!s.missing, "{}", s.message);
        assert!((s.elevation_m.unwrap() - 100.0).abs() < 0.5);
    }

    #[test]
    fn samples_deflate_float_geotiff() {
        let path = write_test_float_geotiff(true, false);
        let s = sample_elevation(path.to_str().unwrap(), 49.995, 30.005).unwrap();
        assert!(!s.missing, "{}", s.message);
        assert!((s.elevation_m.unwrap() - 100.0).abs() < 0.5);
    }

    #[test]
    fn samples_tiled_float_geotiff() {
        let path = write_test_float_geotiff(false, true);
        let s = sample_elevation(path.to_str().unwrap(), 49.995, 30.005).unwrap();
        assert!(!s.missing, "{}", s.message);
        assert!((s.elevation_m.unwrap() - 100.0).abs() < 0.5);
    }

    #[test]
    fn unsupported_lzw_returns_missing() {
        let path = write_test_float_geotiff_lzw_marked();
        let s = sample_elevation(path.to_str().unwrap(), 49.995, 30.005).unwrap();
        assert!(s.missing, "LZW must be N/A");
    }

    /// `deflate`: zlib-wrap strip; `tiled`: TileWidth/Height instead of strips.
    fn write_test_float_geotiff(deflate: bool, tiled: bool) -> PathBuf {
        use flate2::write::ZlibEncoder;
        use flate2::Compression;
        use std::io::Write as _;

        let mut img = Vec::new();
        for v in [100.0f32, 110.0, 120.0, 130.0] {
            img.extend_from_slice(&v.to_le_bytes());
        }
        let payload = if deflate {
            let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
            enc.write_all(&img).unwrap();
            enc.finish().unwrap()
        } else {
            img
        };

        let scale = {
            let mut d = Vec::new();
            d.extend_from_slice(&0.01f64.to_le_bytes());
            d.extend_from_slice(&0.01f64.to_le_bytes());
            d.extend_from_slice(&0f64.to_le_bytes());
            d
        };
        let tie = {
            let mut d = Vec::new();
            for v in [0f64, 0., 0., 30., 50., 0.] {
                d.extend_from_slice(&v.to_le_bytes());
            }
            d
        };

        // strip: 10 tags; tiled: 11 tags (TileWidth/Length/Offsets/ByteCounts replace strip trio)
        let entries = if tiled { 11u16 } else { 10u16 };
        let ifd_len = 2 + (entries as usize) * 12 + 4;
        let ext_start = 8 + ifd_len;
        let scale_off = ext_start as u32;
        let tie_off = scale_off + scale.len() as u32;
        let img_off = tie_off + tie.len() as u32;

        let mut file = Vec::new();
        file.extend_from_slice(b"II");
        file.extend_from_slice(&42u16.to_le_bytes());
        file.extend_from_slice(&8u32.to_le_bytes());
        file.extend_from_slice(&entries.to_le_bytes());

        let write_entry = |file: &mut Vec<u8>, tag: u16, typ: u16, count: u32, value: &[u8]| {
            file.extend_from_slice(&tag.to_le_bytes());
            file.extend_from_slice(&typ.to_le_bytes());
            file.extend_from_slice(&count.to_le_bytes());
            let mut v = [0u8; 4];
            let n = value.len().min(4);
            v[..n].copy_from_slice(&value[..n]);
            file.extend_from_slice(&v);
        };

        write_entry(&mut file, 256, 3, 1, &2u16.to_le_bytes());
        write_entry(&mut file, 257, 3, 1, &2u16.to_le_bytes());
        write_entry(&mut file, 258, 3, 1, &32u16.to_le_bytes());
        let comp: u16 = if deflate { 8 } else { 1 };
        write_entry(&mut file, 259, 3, 1, &comp.to_le_bytes());
        if tiled {
            write_entry(&mut file, 322, 3, 1, &2u16.to_le_bytes()); // TileWidth
            write_entry(&mut file, 323, 3, 1, &2u16.to_le_bytes()); // TileLength
            write_entry(&mut file, 324, 4, 1, &img_off.to_le_bytes());
            write_entry(&mut file, 325, 4, 1, &(payload.len() as u32).to_le_bytes());
        } else {
            write_entry(&mut file, 273, 4, 1, &img_off.to_le_bytes());
            write_entry(&mut file, 278, 4, 1, &2u32.to_le_bytes());
            write_entry(&mut file, 279, 4, 1, &(payload.len() as u32).to_le_bytes());
        }
        write_entry(&mut file, 339, 3, 1, &3u16.to_le_bytes());
        write_entry(&mut file, 33550, 12, 3, &scale_off.to_le_bytes());
        write_entry(&mut file, 33922, 12, 6, &tie_off.to_le_bytes());
        file.extend_from_slice(&0u32.to_le_bytes());
        assert_eq!(file.len(), ext_start);
        file.extend_from_slice(&scale);
        file.extend_from_slice(&tie);
        file.extend_from_slice(&payload);

        let name = if tiled {
            "ags_dem_f32_tiled.tif"
        } else if deflate {
            "ags_dem_f32_deflate.tif"
        } else {
            "ags_dem_f32.tif"
        };
        let path = std::env::temp_dir().join(name);
        std::fs::write(&path, &file).unwrap();
        path
    }

    fn write_test_float_geotiff_lzw_marked() -> PathBuf {
        // Same layout as strip float DEM but Compression=5 (LZW) — must N/A.
        let path = write_test_float_geotiff(false, false);
        let mut file = std::fs::read(&path).unwrap();
        // IFD entry for tag 259 is the 4th entry (index 3): offset 8+2+3*12 = 46
        // value short at +8 within entry → absolute 54
        let comp_val_off = 8 + 2 + 3 * 12 + 8;
        file[comp_val_off..comp_val_off + 2].copy_from_slice(&5u16.to_le_bytes());
        let out = std::env::temp_dir().join("ags_dem_f32_lzw.tif");
        std::fs::write(&out, &file).unwrap();
        out
    }

}
