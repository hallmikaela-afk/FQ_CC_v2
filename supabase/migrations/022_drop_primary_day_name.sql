-- Remove primary_day_name from projects — this data now lives in event_days.day_name WHERE sort_order = 0
-- Migration 021 already backfilled the event_days rows using this value before we drop it.
ALTER TABLE projects DROP COLUMN IF EXISTS primary_day_name;
