-- Add has_attachments column to emails
ALTER TABLE emails ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;

-- Remove duplicate email rows, keeping the one with the lowest id (earliest inserted)
-- This handles any duplicates that may have slipped in before the unique constraint was enforced
DELETE FROM emails
WHERE id NOT IN (
  SELECT MIN(id)
  FROM emails
  GROUP BY message_id
);
