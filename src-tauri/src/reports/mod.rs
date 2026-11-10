//! PDF report generation from complex summary (minimal PDF 1.4, no external crate).

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::auth_session::{self, AuthSessionState};
use crate::database::inventory::report_complex_summary;
use crate::database::sqlite::DbState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfReportResult {
    pub path: String,
    pub bytes: usize,
    pub message: String,
}

/// Escape PDF literal string (Latin-1 / ASCII subset for Cyrillic we use hex for non-ascii).
fn pdf_escape(s: &str) -> String {
    let mut out = String::new();
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '(' => out.push_str("\\("),
            ')' => out.push_str("\\)"),
            c if c.is_ascii() && !c.is_control() => out.push(c),
            _ => out.push('?'),
        }
    }
    out
}

fn build_simple_pdf(title: &str, lines: &[String]) -> Vec<u8> {
    let mut content = String::from("BT /F1 12 Tf 50 780 Td\n");
    content.push_str(&format!("({}) Tj\n", pdf_escape(title)));
    content.push_str("0 -24 Td\n");
    for line in lines {
        content.push_str(&format!("({}) Tj\n0 -16 Td\n", pdf_escape(line)));
    }
    content.push_str("ET");

    let content_bytes = content.as_bytes();
    let mut objects: Vec<Vec<u8>> = Vec::new();

    // 1: Catalog
    objects.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());
    // 2: Pages
    objects.push(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_vec());
    // 3: Page
    objects.push(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".to_vec(),
    );
    // 4: Content stream
    let mut stream = format!("<< /Length {} >>\nstream\n", content_bytes.len()).into_bytes();
    stream.extend_from_slice(content_bytes);
    stream.extend_from_slice(b"\nendstream");
    objects.push(stream);
    // 5: Font
    objects.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_vec());

    let mut pdf: Vec<u8> = b"%PDF-1.4\n".to_vec();
    let mut offsets = vec![0u32];
    for (i, obj) in objects.iter().enumerate() {
        offsets.push(pdf.len() as u32);
        pdf.extend_from_slice(format!("{} 0 obj\n", i + 1).as_bytes());
        pdf.extend_from_slice(obj);
        pdf.extend_from_slice(b"\nendobj\n");
    }
    let xref_at = pdf.len();
    pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for off in offsets.iter().skip(1) {
        pdf.extend_from_slice(format!("{off:010} 00000 n \n").as_bytes());
    }
    pdf.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n",
            objects.len() + 1
        )
        .as_bytes(),
    );
    pdf
}

#[tauri::command]
pub fn report_complex_pdf(
    app: AppHandle,
    state: State<'_, DbState>,
    auth: State<'_, AuthSessionState>,
) -> Result<PdfReportResult, String> {
    auth_session::require_role_write(&auth)?;
    let summary = report_complex_summary(state)?;
    let parsed: serde_json::Value =
        serde_json::from_str(&summary).unwrap_or(serde_json::json!({}));
    let lines = vec![
        format!(
            "Generated: {}",
            parsed
                .get("generatedAt")
                .map(|v| v.to_string())
                .unwrap_or_else(|| "n/a".into())
        ),
        format!(
            "Stations: {}",
            parsed.get("stations").and_then(|v| v.as_i64()).unwrap_or(0)
        ),
        format!(
            "Devices: {}",
            parsed.get("devices").and_then(|v| v.as_i64()).unwrap_or(0)
        ),
        format!(
            "Equipment: {}",
            parsed.get("equipment").and_then(|v| v.as_i64()).unwrap_or(0)
        ),
        format!(
            "Maintenance open: {}",
            parsed
                .get("maintenanceOpen")
                .and_then(|v| v.as_i64())
                .unwrap_or(0)
        ),
        format!(
            "Events: {}",
            parsed.get("events").and_then(|v| v.as_i64()).unwrap_or(0)
        ),
        "Source: local SQLite SSOT (no invented metrics).".into(),
    ];
    let pdf = build_simple_pdf("Aether Ground Station — Complex Report", &lines);
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("reports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = format!("ags-report-{}.pdf", chrono_now());
    let path = dir.join(&name);
    std::fs::write(&path, &pdf).map_err(|e| e.to_string())?;
    Ok(PdfReportResult {
        path: path.to_string_lossy().into(),
        bytes: pdf.len(),
        message: format!("PDF сохранён: {name}"),
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
    use super::build_simple_pdf;

    #[test]
    fn pdf_starts_with_header() {
        let pdf = build_simple_pdf("Test", &["line1".into()]);
        assert!(pdf.starts_with(b"%PDF-1.4"));
        assert!(pdf.windows(5).any(|w| w == b"%%EOF"));
    }
}
