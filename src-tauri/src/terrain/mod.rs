//! Terrain / DEM — GeoTIFF inspect + elevation sampling for uncompressed rasters.
//! Missing / unsupported formats → elevation null (N/A), never invented.

use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::sync::Mutex;
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
    /// TIFF Predictor: 1=none, 2=horizontal, 3=floating-point
    predictor: u16,
    nodata: Option<f64>,
}

struct RasterCache {
    path: String,
    raster: TiffRaster,
    blocks: HashMap<u64, Vec<u8>>,
}

static RASTER_CACHE: Mutex<Option<RasterCache>> = Mutex::new(None);

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
    if magic == 43 {
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
                message: "BigTIFF не поддерживается — высота N/A".into(),
            },
            None,
        ));
    }
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
    let mut predictor = 1u16;
    let mut nodata = None;

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
            317 => predictor = read_u16(&val[0..2], little),
            42113 => {
                let raw = read_tag_values(&mut f, little, typ, count, val)?;
                let s = String::from_utf8_lossy(&raw)
                    .trim_end_matches('\0')
                    .trim()
                    .to_string();
                if let Ok(v) = s.parse::<f64>() {
                    nodata = Some(v);
                }
            }
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
        predictor,
        nodata,
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

fn is_nodata(raster: &TiffRaster, v: f64) -> bool {
    if let Some(nd) = raster.nodata {
        if (v - nd).abs() < 1e-3 {
            return true;
        }
    }
    false
}

fn decode_sample(raster: &TiffRaster, buf: &[u8]) -> Result<Option<f64>, String> {
    if buf.len() < (raster.bits_per_sample / 8).max(1) as usize {
        return Ok(None);
    }
    match (raster.bits_per_sample, raster.sample_format) {
        (32, 3) => {
            let b: [u8; 4] = buf[..4].try_into().map_err(|_| "short float sample")?;
            let f32v = if raster.little {
                f32::from_le_bytes(b)
            } else {
                f32::from_be_bytes(b)
            };
            let v = f32v as f64;
            if !f32v.is_finite() || is_nodata(raster, v) || v < -1200.0 || v > 9000.0 {
                return Ok(None);
            }
            Ok(Some(v))
        }
        (16, 2) => {
            let b: [u8; 2] = buf[..2].try_into().map_err(|_| "short int16 sample")?;
            let i = if raster.little {
                i16::from_le_bytes(b)
            } else {
                i16::from_be_bytes(b)
            };
            let v = i as f64;
            if i == i16::MIN || i <= -9999 || is_nodata(raster, v) {
                return Ok(None);
            }
            Ok(Some(v))
        }
        (16, 1) => {
            let b: [u8; 2] = buf[..2].try_into().map_err(|_| "short uint16 sample")?;
            let u = if raster.little {
                u16::from_le_bytes(b)
            } else {
                u16::from_be_bytes(b)
            };
            let v = u as f64;
            // 0 is a valid elevation (sea / datum); only drop explicit nodata / u16::MAX sentinel.
            if u == u16::MAX || is_nodata(raster, v) {
                return Ok(None);
            }
            Ok(Some(v))
        }
        (32, 1) | (32, 2) => {
            let b: [u8; 4] = buf[..4].try_into().map_err(|_| "short int32 sample")?;
            let i = if raster.little {
                i32::from_le_bytes(b)
            } else {
                i32::from_be_bytes(b)
            };
            let v = i as f64;
            if i <= -9999 || is_nodata(raster, v) {
                return Ok(None);
            }
            Ok(Some(v))
        }
        _ => Err(format!(
            "Формат sample bits={} format={} не поддерживается",
            raster.bits_per_sample, raster.sample_format
        )),
    }
}

fn apply_predictor(raster: &TiffRaster, data: &mut [u8], width: usize, rows: usize) {
    let bpp = (raster.bits_per_sample / 8).max(1) as usize;
    let row_bytes = width.saturating_mul(bpp);
    if row_bytes == 0 || rows == 0 {
        return;
    }
    match raster.predictor {
        2 => {
            for r in 0..rows {
                let start = r * row_bytes;
                let end = (start + row_bytes).min(data.len());
                if end <= start + bpp {
                    continue;
                }
                let row = &mut data[start..end];
                for i in bpp..row.len() {
                    row[i] = row[i].wrapping_add(row[i - bpp]);
                }
            }
        }
        3 => {
            for r in 0..rows {
                let start = r * row_bytes;
                let end = (start + row_bytes).min(data.len());
                if end - start != row_bytes {
                    continue;
                }
                let row = &mut data[start..end];
                for i in 1..row.len() {
                    row[i] = row[i].wrapping_add(row[i - 1]);
                }
                let tmp = row.to_vec();
                for sample in 0..width {
                    for b in 0..bpp {
                        let src = b * width + sample;
                        let dst = sample * bpp + b;
                        if src < tmp.len() && dst < row.len() {
                            row[dst] = tmp[src];
                        }
                    }
                }
            }
        }
        _ => {}
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

fn load_block(
    raster: &TiffRaster,
    path: &str,
    kind: u8,
    index: usize,
) -> Result<Vec<u8>, String> {
    let (off, nbytes, width, rows) = if kind == 1 {
        let tw = raster.tile_width.unwrap_or(0) as usize;
        let th = raster.tile_height.unwrap_or(0) as usize;
        let off = *raster.tile_offsets.get(index).ok_or("tile index")?;
        let nbytes = raster.tile_byte_counts.get(index).copied().unwrap_or(0) as usize;
        (off, nbytes, tw, th)
    } else {
        let off = *raster.strip_offsets.get(index).ok_or("strip index")?;
        let nbytes = raster.strip_byte_counts.get(index).copied().unwrap_or(0) as usize;
        let rows = raster.rows_per_strip as usize;
        (off, nbytes, raster.width as usize, rows)
    };
    if nbytes == 0 || width == 0 {
        return Ok(Vec::new());
    }
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    f.seek(SeekFrom::Start(off)).map_err(|e| e.to_string())?;
    let mut raw = vec![0u8; nbytes];
    f.read_exact(&mut raw).map_err(|e| e.to_string())?;
    let mut data = inflate_if_needed(raster.compression, &raw)?;
    let bpp = (raster.bits_per_sample / 8).max(1) as usize;
    let actual_rows = if data.len() >= width * bpp {
        (data.len() / (width * bpp)).min(rows.max(1))
    } else {
        0
    };
    apply_predictor(raster, &mut data, width, actual_rows);
    Ok(data)
}

fn cached_block(path: &str, kind: u8, index: usize) -> Result<Vec<u8>, String> {
    let key = ((kind as u64) << 32) | index as u64;
    {
        let guard = RASTER_CACHE.lock().map_err(|e| e.to_string())?;
        if let Some(c) = guard.as_ref() {
            if c.path == path {
                if let Some(b) = c.blocks.get(&key) {
                    return Ok(b.clone());
                }
            }
        }
    }
    let raster = cached_raster(path)?;
    let data = load_block(&raster, path, kind, index)?;
    if let Ok(mut guard) = RASTER_CACHE.lock() {
        if let Some(c) = guard.as_mut() {
            if c.path == path {
                if c.blocks.len() > 96 {
                    c.blocks.clear();
                }
                c.blocks.insert(key, data.clone());
            }
        }
    }
    Ok(data)
}

fn cached_raster(path: &str) -> Result<TiffRaster, String> {
    if let Ok(guard) = RASTER_CACHE.lock() {
        if let Some(c) = guard.as_ref() {
            if c.path == path {
                return Ok(c.raster.clone());
            }
        }
    }
    let (_info, raster_opt) = parse_raster(path)?;
    let raster = raster_opt.ok_or_else(|| "Не удалось разобрать raster IFD".to_string())?;
    if let Ok(mut guard) = RASTER_CACHE.lock() {
        *guard = Some(RasterCache {
            path: path.to_string(),
            raster: raster.clone(),
            blocks: HashMap::new(),
        });
    }
    Ok(raster)
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
        let data = cached_block(path, 1, tile_index)?;
        let x = (col % tw) as usize;
        let y = (row % th) as usize;
        let idx = (y * tw as usize + x) * bytes_pp;
        if idx + bytes_pp > data.len() {
            return Ok(None);
        }
        return decode_sample(raster, &data[idx..idx + bytes_pp]);
    }

    // Strip path — uncompressed + no predictor can seek a single pixel.
    let strip_index = (row / raster.rows_per_strip) as usize;
    if strip_index >= raster.strip_offsets.len() {
        return Ok(None);
    }
    let row_in_strip = row % raster.rows_per_strip;

    if raster.compression == 1 && raster.predictor <= 1 {
        let mut f = File::open(path).map_err(|e| e.to_string())?;
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

    let data = cached_block(path, 0, strip_index)?;
    let idx = (row_in_strip as usize * raster.width as usize + col as usize) * bytes_pp;
    if idx + bytes_pp > data.len() {
        return Ok(None);
    }
    decode_sample(raster, &data[idx..idx + bytes_pp])
}

fn lonlat_to_pixel(raster: &TiffRaster, latitude: f64, longitude: f64) -> Result<(u32, u32), String> {
    let (Some(sx), Some(sy), Some(ox), Some(oy)) =
        (raster.scale_x, raster.scale_y, raster.origin_x, raster.origin_y)
    else {
        return Err("Нет GeoTIFF тегов ModelPixelScale/ModelTiepoint — высота N/A".into());
    };
    if sx.abs() < 1e-15 || sy.abs() < 1e-15 {
        return Err("Некорректный pixel scale".into());
    }
    let col_f = (longitude - ox) / sx;
    let row_f = (oy - latitude) / sy.abs();
    if col_f < 0.0 || row_f < 0.0 {
        return Err("Точка вне растра".into());
    }
    Ok((col_f.floor() as u32, row_f.floor() as u32))
}

pub fn sample_elevation(path: &str, latitude: f64, longitude: f64) -> Result<ElevationSample, String> {
    let raster = match cached_raster(path) {
        Ok(r) => r,
        Err(e) => {
            return Ok(ElevationSample {
                path: path.into(),
                latitude,
                longitude,
                elevation_m: None,
                missing: true,
                message: e,
            });
        }
    };
    let (col, row) = match lonlat_to_pixel(&raster, latitude, longitude) {
        Ok(p) => p,
        Err(e) => {
            return Ok(ElevationSample {
                path: path.into(),
                latitude,
                longitude,
                elevation_m: None,
                missing: true,
                message: e,
            });
        }
    };
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElevationGrid {
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
    pub cols: u32,
    pub rows: u32,
    /// null where height is unknown — never filled with 0.
    pub values: Vec<Option<f32>>,
    pub known: u32,
    pub message: String,
}

pub fn sample_grid(
    path: &str,
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    cols: u32,
    rows: u32,
) -> Result<ElevationGrid, String> {
    let cols = cols.clamp(2, 256);
    let rows = rows.clamp(2, 256);
    let raster = cached_raster(path)?;
    let mut values = vec![None; (cols * rows) as usize];
    let mut known = 0u32;
    let dlon = (east - west) / cols as f64;
    let dlat = (north - south) / rows as f64;
    for r in 0..rows {
        let lat = north - (r as f64 + 0.5) * dlat;
        for c in 0..cols {
            let lon = west + (c as f64 + 0.5) * dlon;
            if let Ok((col, row)) = lonlat_to_pixel(&raster, lat, lon) {
                if let Ok(Some(elev)) = sample_pixel(&raster, path, col, row) {
                    values[(r * cols + c) as usize] = Some(elev as f32);
                    known += 1;
                }
            }
        }
    }
    Ok(ElevationGrid {
        west,
        south,
        east,
        north,
        cols,
        rows,
        values,
        known,
        message: format!("grid {cols}×{rows} · known={known}"),
    })
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
pub fn terrain_sample_grid(
    path: String,
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    cols: u32,
    rows: u32,
) -> Result<ElevationGrid, String> {
    sample_grid(&path, west, south, east, north, cols, rows)
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

    #[test]
    fn samples_predictor2_float_geotiff() {
        let path = write_test_float_geotiff_predictor2();
        let s = sample_elevation(path.to_str().unwrap(), 49.995, 30.005).unwrap();
        assert!(!s.missing, "{}", s.message);
        assert!((s.elevation_m.unwrap() - 100.0).abs() < 0.5);
    }

    #[test]
    fn sample_grid_uses_nan_for_outside() {
        let path = write_test_float_geotiff(false, false);
        let g = super::sample_grid(path.to_str().unwrap(), 29.99, 49.99, 30.02, 50.01, 8, 8)
            .unwrap();
        assert!(g.known > 0, "{}", g.message);
        assert_eq!(g.values.len(), 64);
        assert!(
            g.values.iter().any(|v| v.is_none()),
            "outside cells stay null (Н/Д)"
        );
    }

    fn write_test_float_geotiff_predictor2() -> PathBuf {
        let mut img = Vec::new();
        for v in [100.0f32, 110.0, 120.0, 130.0] {
            img.extend_from_slice(&v.to_le_bytes());
        }
        // Horizontal differencing, 4 bytes/sample, 2×2.
        let bpp = 4usize;
        let width = 2usize;
        for r in 0..2 {
            let start = r * width * bpp;
            let row = &mut img[start..start + width * bpp];
            for i in (bpp..row.len()).rev() {
                row[i] = row[i].wrapping_sub(row[i - bpp]);
            }
        }

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
        let entries = 11u16;
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
        write_entry(&mut file, 259, 3, 1, &1u16.to_le_bytes());
        write_entry(&mut file, 273, 4, 1, &img_off.to_le_bytes());
        write_entry(&mut file, 278, 4, 1, &2u32.to_le_bytes());
        write_entry(&mut file, 279, 4, 1, &(img.len() as u32).to_le_bytes());
        write_entry(&mut file, 317, 3, 1, &2u16.to_le_bytes());
        write_entry(&mut file, 339, 3, 1, &3u16.to_le_bytes());
        write_entry(&mut file, 33550, 12, 3, &scale_off.to_le_bytes());
        write_entry(&mut file, 33922, 12, 6, &tie_off.to_le_bytes());
        file.extend_from_slice(&0u32.to_le_bytes());
        assert_eq!(file.len(), ext_start);
        file.extend_from_slice(&scale);
        file.extend_from_slice(&tie);
        file.extend_from_slice(&img);
        let path = std::env::temp_dir().join(format!(
            "ags_dem_f32_pred2_{}_{}.tif",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::write(&path, &file).unwrap();
        path
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

        let uniq = format!(
            "{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        let name = if tiled {
            format!("ags_dem_f32_tiled_{uniq}.tif")
        } else if deflate {
            format!("ags_dem_f32_deflate_{uniq}.tif")
        } else {
            format!("ags_dem_f32_{uniq}.tif")
        };
        let path = std::env::temp_dir().join(name);
        std::fs::write(&path, &file).unwrap();
        path
    }

    fn write_test_float_geotiff_lzw_marked() -> PathBuf {
        // Own fixture bytes (do not share temp path with parallel uncompressed test).
        let path = write_test_float_geotiff(false, false);
        let mut file = std::fs::read(&path).unwrap();
        let _ = std::fs::remove_file(&path);
        // IFD entry for tag 259 is the 4th entry (index 3): offset 8+2+3*12 = 46
        // value short at +8 within entry → absolute 54
        let comp_val_off = 8 + 2 + 3 * 12 + 8;
        assert!(file.len() > comp_val_off + 2, "fixture too short");
        file[comp_val_off..comp_val_off + 2].copy_from_slice(&5u16.to_le_bytes());
        let out = std::env::temp_dir().join(format!(
            "ags_dem_f32_lzw_{}_{}.tif",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::write(&out, &file).unwrap();
        out
    }

}
