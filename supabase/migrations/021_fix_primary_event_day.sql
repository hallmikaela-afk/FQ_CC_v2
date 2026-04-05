-- Fix: ensure every project has a primary event day row (sort_order = 0)
-- and every vendor points to a real event_day_id (no more NULL = "Wedding Day")

-- 1. Insert missing primary event day rows for all projects that lack one
INSERT INTO event_days (project_id, day_name, event_date, sort_order)
SELECT
  p.id,
  COALESCE(p.primary_day_name, 'Wedding Day'),
  p.event_date,
  0
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM event_days ed
  WHERE ed.project_id = p.id AND ed.sort_order = 0
);

-- 2. Point any vendor with event_day_id IS NULL to their project's primary event day
UPDATE vendors v
SET event_day_id = ed.id
FROM event_days ed
WHERE ed.project_id = v.project_id
  AND ed.sort_order = 0
  AND v.event_day_id IS NULL;

-- 3. Add NOT NULL constraint — every vendor must now have a real event day FK
ALTER TABLE vendors ALTER COLUMN event_day_id SET NOT NULL;
