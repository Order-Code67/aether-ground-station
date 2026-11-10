# SQLite schema (V2 Core)

Versioned via `schema_migrations`. Current: **2**.

## v1 (legacy 0.4)

profiles, workspace_layouts, event_log, archive_clips, settings_kv, devices, video_sources, recordings, users, audit_log, kv_json + indexes.

## v2

complexes, station_sites, stations (AMSL fields), mast_profiles, antenna_profiles, terrain_sources, terrain_profiles, telemetry_records, network_nodes, equipment_inventory, maintenance_records, diagnostic_reports.

## Antenna AMSL

`antenna_center_amsl_m = terrain_elevation_m + mast_height_m + antenna_offset_m`  
If terrain is NULL → antenna center is NULL (N/A).
