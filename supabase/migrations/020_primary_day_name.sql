-- Allow the primary "Wedding Day" label to be renamed per project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_day_name TEXT DEFAULT 'Wedding Day';
