-- Add function field to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS function TEXT;

-- Set initial functions based on role patterns
UPDATE team_members SET function = 'Planner' WHERE role ILIKE '%plan%';
UPDATE team_members SET function = 'Designer' WHERE role ILIKE '%design%' OR role ILIKE '%creative%';
