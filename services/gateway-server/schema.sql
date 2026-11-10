-- Aether Central Gateway — PostgreSQL schema (production ingest)
CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_received ON sync_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_events_kind ON sync_events (kind);

CREATE TABLE IF NOT EXISTS stations_mirror (
  id TEXT PRIMARY KEY,
  name TEXT,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No pilot / actuator command tables by design.
