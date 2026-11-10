# Aether GS — Permission Matrix (P1-5)

**Session source of truth:** `auth_login` → in-memory `AuthSessionState` (role).  
**Observer rule:** `require_role_write` rejects Observer before mutation.  
**DB ACL:** `permissions::require` maps role → Permission (users table).

| Command | Write? | Guard |
|---------|--------|-------|
| `auth_login` | — | password verify |
| `auth_bind_session` | — | **disabled** (P0) |
| `auth_clear_session` | — | any |
| `db_upsert_user` | yes | `require_role_write` + ManageUsers |
| `db_upsert_json` / settings / backup / restore | yes* | restore/backup: open; upserts: as implemented |
| `station_upsert` / `station_delete` | yes | `require_role_write` + ManageDevices |
| `inventory_upsert` / `maintenance_upsert` | yes | `require_role_write` + ManageDevices |
| `telemetry_append` | yes | as implemented |
| `serial_open` / `write` / `close` | yes | `require_role_write` |
| `video_probe_rtsp` / bridge start/stop | yes | `require_role_write` |
| `terrain_register_source` | yes | `require_role_write` |
| `gateway_set_config` / enqueue / try_sync / retry_failed | yes | `require_role_write` |
| `report_complex_pdf` | yes | `require_role_write` |
| list/status/get_* | no | open or session optional |

\* Observer must not mutate SSOT; UI hides writes, backend enforces on listed commands.

## Role → Permission

| Role | ManageUsers | ManageDevices | WriteHardware | ViewOnly |
|------|-------------|---------------|---------------|----------|
| Administrator | ✓ | ✓ | ✓ | ✓ |
| Operator | — | ✓ | ✓ | ✓ |
| Observer | — | — | — | ✓ |
