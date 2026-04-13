-- Fox & Quinn — Backfill global vendor_directory from per-project vendors
-- Option B: non-destructive. vendors table stays in place as the project-page
-- source of truth. This migration populates the global tables and wires up
-- directory_vendor_id so vendor names on project pages link to the directory.
--
-- Safe to re-run: each step guards against duplicates.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Insert one vendor_directory record per distinct vendor name.
--
-- Deduplication: case-insensitive vendor_name. When the same name appears in
-- multiple project rows, the row with the most populated contact fields wins;
-- ties broken by earliest created_at.
--
-- Skips names that already exist in vendor_directory (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vendor_directory (name, category, email, phone, instagram, website)
SELECT
  ranked.vendor_name,
  ranked.category,
  ranked.email,
  ranked.phone,
  ranked.instagram,
  ranked.website
FROM (
  SELECT DISTINCT ON (lower(trim(vendor_name)))
    vendor_name,
    category,
    email,
    phone,
    instagram,
    website,
    created_at
  FROM vendors
  ORDER BY
    lower(trim(vendor_name)),
    (CASE WHEN email     IS NOT NULL AND email     <> '' THEN 1 ELSE 0 END
   + CASE WHEN phone     IS NOT NULL AND phone     <> '' THEN 1 ELSE 0 END
   + CASE WHEN instagram IS NOT NULL AND instagram <> '' THEN 1 ELSE 0 END
   + CASE WHEN website   IS NOT NULL AND website   <> '' THEN 1 ELSE 0 END) DESC,
    created_at ASC
) ranked
WHERE NOT EXISTS (
  SELECT 1
  FROM vendor_directory vd
  WHERE lower(trim(vd.name)) = lower(trim(ranked.vendor_name))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Set directory_vendor_id on every vendors row.
-- Matches on lower(trim(vendor_name)). Only updates rows still NULL.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE vendors v
SET directory_vendor_id = vd.id
FROM vendor_directory vd
WHERE lower(trim(v.vendor_name)) = lower(trim(vd.name))
  AND v.directory_vendor_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Create vendor_contacts from distinct contact_name values.
--
-- One row per (directory_vendor_id, contact_name) pair.
-- Only rows not already present in vendor_contacts are inserted.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vendor_contacts (vendor_id, name, is_primary)
SELECT
  deduped.directory_vendor_id,
  deduped.contact_name,
  false   -- is_primary updated in the follow-up step below
FROM (
  SELECT DISTINCT ON (directory_vendor_id, lower(trim(contact_name)))
    directory_vendor_id,
    contact_name,
    created_at
  FROM vendors
  WHERE contact_name IS NOT NULL
    AND trim(contact_name) <> ''
    AND directory_vendor_id IS NOT NULL
  ORDER BY directory_vendor_id, lower(trim(contact_name)), created_at ASC
) deduped
WHERE NOT EXISTS (
  SELECT 1
  FROM vendor_contacts vc
  WHERE vc.vendor_id = deduped.directory_vendor_id
    AND lower(trim(vc.name)) = lower(trim(deduped.contact_name))
);

-- Mark the earliest-created contact per vendor as primary, but only if that
-- vendor has no primary contact yet.
UPDATE vendor_contacts vc
SET is_primary = true
WHERE vc.id IN (
  SELECT DISTINCT ON (vendor_id) id
  FROM vendor_contacts
  ORDER BY vendor_id, created_at ASC
)
AND NOT EXISTS (
  SELECT 1
  FROM vendor_contacts vc2
  WHERE vc2.vendor_id = vc.vendor_id
    AND vc2.is_primary = true
    AND vc2.id <> vc.id
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Create vendor_project_links for each unique (vendor, project) pair.
-- Skips pairs that already exist (ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vendor_project_links (vendor_id, project_id)
SELECT DISTINCT
  v.directory_vendor_id,
  v.project_id
FROM vendors v
WHERE v.directory_vendor_id IS NOT NULL
ON CONFLICT (vendor_id, project_id) DO NOTHING;
