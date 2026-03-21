-- Migrate existing proposal_sent records to active
UPDATE projects SET status = 'active' WHERE status = 'proposal_sent';

-- Drop old constraint and add updated one
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'archived'));
