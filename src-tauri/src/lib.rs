mod auth_session;
mod commands;
mod database;
mod gateway;
mod hardware;
mod network;
mod reports;
mod terrain;
mod video;

use auth_session::AuthSessionState;
use database::sqlite::DbState;
use hardware::serial::SerialState;
use tauri::Manager;
use video::RtspBridgeState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SerialState::default())
        .manage(DbState::default())
        .manage(AuthSessionState::default())
        .manage(RtspBridgeState::default())
        .setup(|app| {
            let state = app.state::<DbState>();
            let _ = database::sqlite::open_and_migrate(&state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            auth_session::auth_login,
            auth_session::auth_bind_session,
            auth_session::auth_clear_session,
            auth_session::auth_touch,
            auth_session::auth_set_idle_timeout,
            hardware::serial::serial_list_ports,
            hardware::serial::serial_open,
            hardware::serial::serial_close,
            hardware::serial::serial_write,
            hardware::serial::serial_write_bytes,
            hardware::serial::serial_get_status,
            hardware::usb::list_usb_devices,
            hardware::ethernet::list_network_interfaces,
            hardware::ethernet::probe_host,
            video::video_ffmpeg_status,
            video::video_probe_rtsp,
            video::video_rtsp_bridge_start,
            video::video_rtsp_bridge_stop,
            video::video_rtsp_bridge_status,
            video::video_rtsp_bridge_frame,
            terrain::terrain_inspect_geotiff,
            terrain::terrain_sample_elevation,
            terrain::terrain_register_source,
            gateway::gateway_get_config,
            gateway::gateway_set_config,
            gateway::gateway_status,
            gateway::gateway_enqueue,
            gateway::gateway_try_sync,
            gateway::gateway_retry_failed,
            reports::report_complex_pdf,
            database::sqlite::db_init,
            database::sqlite::db_schema_version,
            database::sqlite::db_append_event,
            database::sqlite::db_list_events,
            database::sqlite::db_upsert_setting,
            database::sqlite::db_get_setting,
            database::sqlite::db_backup,
            database::sqlite::db_restore,
            database::sqlite::db_upsert_json,
            database::sqlite::db_get_json,
            database::sqlite::db_list_users,
            database::sqlite::db_upsert_user,
            database::sqlite::db_verify_user_password,
            database::sqlite::db_upsert_recording,
            database::sqlite::db_list_recordings,
            database::sqlite::db_audit,
            database::stations::station_list,
            database::stations::station_upsert,
            database::stations::station_delete,
            database::inventory::inventory_list,
            database::inventory::inventory_upsert,
            database::inventory::maintenance_list,
            database::inventory::maintenance_upsert,
            database::inventory::telemetry_append,
            database::inventory::telemetry_list,
            database::inventory::report_complex_summary,
        ])
        .build(tauri::generate_context!())
        .expect("ошибка сборки Aether Ground Station")
        .run(|app_handle, event| {
            if matches!(
                event,
                tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
            ) {
                if let Some(bridge) = app_handle.try_state::<RtspBridgeState>() {
                    bridge.force_stop();
                }
            }
        });
}
