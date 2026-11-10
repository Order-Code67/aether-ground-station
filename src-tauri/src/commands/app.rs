use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub stage: &'static str,
    pub platform: &'static str,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Aether Ground Station",
        version: env!("CARGO_PKG_VERSION"),
        stage: "2.0-core",
        platform: std::env::consts::OS,
    }
}
