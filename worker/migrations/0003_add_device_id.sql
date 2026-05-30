-- Migration number: 0003
-- Add device_id column to daily_stats for multi-device support
-- Changes primary key from (uuid, date) to (uuid, device_id, date)

-- Create new table with updated schema
CREATE TABLE IF NOT EXISTS daily_stats_new (
    uuid            TEXT NOT NULL,
    device_id       TEXT NOT NULL DEFAULT '',
    date            TEXT NOT NULL,
    count           INTEGER NOT NULL,
    duration        REAL NOT NULL,
    records_detail  TEXT,
    updated_at      TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uuid, device_id, date),
    FOREIGN KEY (uuid) REFERENCES users(uuid)
);

-- Copy existing data (set device_id to empty string for backward compat)
INSERT INTO daily_stats_new (uuid, device_id, date, count, duration, records_detail, updated_at)
SELECT uuid, '', date, count, duration, records_detail, updated_at
FROM daily_stats;

-- Drop old table and rename
DROP TABLE daily_stats;
ALTER TABLE daily_stats_new RENAME TO daily_stats;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_uuid_date ON daily_stats(uuid, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_device ON daily_stats(uuid, device_id);
