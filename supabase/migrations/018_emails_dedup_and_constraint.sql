-- Remove duplicate email rows using ROW_NUMBER (works with UUID ids)
-- Keeps the earliest received copy of each message
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY message_id
           ORDER BY received_at ASC NULLS LAST
         ) AS rn
  FROM emails
  WHERE message_id IS NOT NULL
)
DELETE FROM emails
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Drop and recreate the unique constraint to guarantee it's enforced going forward
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_message_id_unique;
ALTER TABLE emails ADD CONSTRAINT emails_message_id_unique UNIQUE (message_id);
