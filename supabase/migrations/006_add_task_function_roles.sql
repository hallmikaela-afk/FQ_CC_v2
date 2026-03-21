-- Add function_roles column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS function_roles TEXT[] DEFAULT '{}';

-- Extract "Function: X" patterns from notes into function_roles array,
-- mapping variations to canonical names, then strip them from notes.
UPDATE tasks
SET
  function_roles = ARRAY(
    SELECT DISTINCT
      CASE
        WHEN lower(trim(m[1])) IN ('design', 'designer', 'design & styling') THEN 'Designer'
        WHEN lower(trim(m[1])) IN ('planning', 'planner') THEN 'Planner'
        WHEN lower(trim(m[1])) IN ('admin', 'administration') THEN 'Admin'
        WHEN lower(trim(m[1])) IN ('coordinator', 'coordination') THEN 'Coordinator'
      END
    FROM regexp_matches(notes, 'Function:\s*([^\n,;]+?)(?=\s*Function:|\s*$)', 'g') AS m
    WHERE
      CASE
        WHEN lower(trim(m[1])) IN ('design', 'designer', 'design & styling') THEN 'Designer'
        WHEN lower(trim(m[1])) IN ('planning', 'planner') THEN 'Planner'
        WHEN lower(trim(m[1])) IN ('admin', 'administration') THEN 'Admin'
        WHEN lower(trim(m[1])) IN ('coordinator', 'coordination') THEN 'Coordinator'
      END IS NOT NULL
  ),
  notes = nullif(
    trim(regexp_replace(notes, 'Function:\s*[^\n,;]+?(?=\s*Function:|$)', '', 'g')),
    ''
  )
WHERE notes ~ 'Function:';
