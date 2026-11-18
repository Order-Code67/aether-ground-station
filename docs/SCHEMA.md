# SQLite schema (Aether GS)

Versioned via `schema_migrations`. Current: **5**.

## v1 (legacy)

profiles, workspace_layouts, event_log, archive_clips, settings_kv, devices, video_sources, recordings, users, audit_log, kv_json + indexes.

## v2

complexes, station_sites, stations (AMSL fields), mast_profiles, antenna_profiles, terrain_sources, terrain_profiles, telemetry_records, network_nodes, equipment_inventory, maintenance_records, diagnostic_reports.

## v3

sync_outbox.

## v4

sync_outbox.attempts, sync_outbox.last_error.

## v5 (GS-2 / GS-4)

- `station_sites.complex_id`, `status`, `address`, `created_at`
- `stations` rebuild: nullable `mast_height_m`, `description`, `status`, `created_at`
- `station_antenna_mounts`
- `station_placement_scenarios`
- mast/antenna catalog columns (manufacturer, RF fields as nullable)
- `equipment_inventory` station/complex/site/category/installed_at

## Antenna AMSL

`antenna_center_amsl_m = terrain_elevation_m + mast_height_m + antenna_offset_m`  
If terrain **or** mast is NULL → antenna center is NULL (N/A). Offset defaults to 0 when mast/terrain known.
