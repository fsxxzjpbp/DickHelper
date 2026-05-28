-- Migration number: 0001
-- Create users and daily_stats tables for leaderboard system

CREATE TABLE IF NOT EXISTS users (
    uuid       TEXT PRIMARY KEY,
    nickname   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_stats (
    uuid       TEXT NOT NULL,
    date       TEXT NOT NULL,
    count      INTEGER NOT NULL,
    duration   REAL NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uuid, date),
    FOREIGN KEY (uuid) REFERENCES users(uuid)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_uuid_date ON daily_stats(uuid, date);
