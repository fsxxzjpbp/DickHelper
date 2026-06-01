-- Migration number: 0004
-- Create telemetry_daily table for anonymous device activity tracking

CREATE TABLE IF NOT EXISTS telemetry_daily (
    uuid         TEXT NOT NULL,
    date         TEXT NOT NULL,          -- 'YYYY-MM-DD' UTC+8
    platform     TEXT NOT NULL,          -- 'desktop' / 'mobile'
    app_version  TEXT NOT NULL,
    os           TEXT NOT NULL,
    last_seen_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uuid, date)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_date ON telemetry_daily(date);
CREATE INDEX IF NOT EXISTS idx_telemetry_platform ON telemetry_daily(platform);
