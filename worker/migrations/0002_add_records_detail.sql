-- Migration number: 0002
-- Add records_detail column to daily_stats for per-record tracking (multi-device merge support)

ALTER TABLE daily_stats ADD COLUMN records_detail TEXT;
