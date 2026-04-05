-- Fox & Quinn Command Center — Event Days
-- Allows a project to have multiple event days (e.g. rehearsal dinner, ceremony day, brunch)
-- each with its own venue and vendor list

CREATE TABLE IF NOT EXISTS event_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_name TEXT NOT NULL DEFAULT 'Event Day',
  event_date DATE,
  venue_name TEXT,
  venue_street TEXT,
  venue_city_state_zip TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow vendors to be scoped to a specific event day
-- NULL = belongs to the main/primary event day (project-level)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS event_day_id UUID REFERENCES event_days(id) ON DELETE SET NULL;

-- RLS (permissive, consistent with rest of app)
ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON event_days FOR ALL USING (true) WITH CHECK (true);
