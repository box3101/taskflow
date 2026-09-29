CREATE TABLE spike_cloud_days (
  date TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE spike_cloud_snapshots (
  id BIGSERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);
CREATE INDEX spike_cloud_snapshots_date_idx ON spike_cloud_snapshots(date,captured_at);
CREATE TABLE spike_cloud_signals (
  key TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  payload JSONB NOT NULL
);
CREATE INDEX spike_cloud_signals_date_idx ON spike_cloud_signals(date);
