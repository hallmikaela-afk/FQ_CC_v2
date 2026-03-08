-- ============================================
-- Fox & Quinn — Update Client Data with Real Info
-- Run this in Supabase SQL Editor to update live data
-- ============================================

-- Step 1: Add new columns for client contact info
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client1_email TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client2_email TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client1_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client2_phone TEXT;

-- ============================================
-- JULIA & FRANK
-- ============================================
UPDATE projects SET
  service_tier = 'Partial Planning',
  client1_name = 'Julia Mazzucca',
  client2_name = 'Frank Gumina',
  client1_email = 'theguminas@gmail.com',
  client1_phone = '7326164465',
  venue_name = 'Wave Resort',
  venue_location = 'Wave Resort, Ocean Avenue, Long Branch, NJ, USA',
  canva_link = 'https://www.canva.com/design/DAG0StHRpOo/axq2PGAAovxTrooVGZHX9A/edit?utm_content=DAG0StHRpOo&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton',
  internal_file_share = 'https://foxquinn44.sharepoint.com/sites/FullWeddingPlanningTemplate/Julia%20%20Frank%20Documents/Forms/AllItems.aspx',
  client_shared_folder = 'https://foxquinn44.sharepoint.com/:f:/s/FullWeddingPlanningTemplate/IgCnj0BeK70vSrIOfG0CqnNbAf3vP2vKjZ7PnvMhQPeaVIU?e=59OGqe',
  client_website = 'http://foxandquinn.co/the-guminas',
  sharepoint_folder = 'https://foxquinn44.sharepoint.com/sites/FullWeddingPlanningTemplate/Julia%20%20Frank%20Documents/Forms/AllItems.aspx'
WHERE slug = 'julia-frank';

-- ============================================
-- TIPPI & JUSTIN
-- ============================================
UPDATE projects SET
  service_tier = 'Partial Planning',
  client1_name = 'Tippi Pasuk',
  client2_name = 'Justin Chen',
  client1_email = 'tippi.pasuk@gmail.com',
  client1_phone = '12123007196',
  venue_name = 'The Vanderbilt Museum',
  venue_location = 'Suffolk County Vanderbilt Museum and Planetarium, Little Neck Road, Centerport, NY, USA',
  canva_link = 'https://www.canva.com/design/DAG445z3nPI/H6B8qstwOVf3v_keNgOlKg/edit?utm_content=DAG445z3nPI&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton',
  internal_file_share = 'https://foxquinn44.sharepoint.com/sites/FullWeddingPlanningTemplate/Tippi%20%20Justin%20Documents/Forms/AllItems.aspx',
  client_shared_folder = 'https://foxquinn44.sharepoint.com/:f:/s/FullWeddingPlanningTemplate/IgAt0FdfKKZ0TKulXPitaD1nAUflRp9HsM8sor0yDA02Q-o?e=LPT22I',
  client_portal_link = 'http://foxandquinn.co/client-portal-tippi-and-justin',
  sharepoint_folder = 'https://foxquinn44.sharepoint.com/sites/FullWeddingPlanningTemplate/Tippi%20%20Justin%20Documents/Forms/AllItems.aspx'
WHERE slug = 'tippi-justin';

-- ============================================
-- ELISABETH & JJ
-- ============================================
UPDATE projects SET
  service_tier = 'Partial Planning',
  client1_name = 'Elisabeth DiDanato',
  client2_name = 'JJ Codella',
  client1_email = 'elisabeth.didonato@gmail.com',
  client2_email = 'jcodefit@gmail.com',
  client1_phone = '9143463968',
  client2_phone = '8458001108',
  venue_name = 'LionRock Farms',
  venue_location = 'LionRock Farm, Hosier Road, Sharon, CT, USA',
  canva_link = 'https://www.canva.com/design/DAG8_E3sGyc/9_18IbUI2An9y32YFmD82w/edit?utm_content=DAG8_E3sGyc&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton',
  internal_file_share = 'https://foxquinn44.sharepoint.com/sites/FullWeddingPlanningTemplate/Elisabeth%20%20JJ/Forms/AllItems.aspx',
  client_shared_folder = 'https://foxquinn44.sharepoint.com/:f:/s/FullWeddingPlanningTemplate/IgBDOEBUZ7sNSpXY13G4T5frAeBYOAT3SHUzXZ499lO7Mbo?e=6IKYaX',
  client_portal_link = 'http://foxandquinn.co/client-portal-elisabeth-and-jj',
  sharepoint_folder = 'https://foxquinn44.sharepoint.com/sites/FullWeddingPlanningTemplate/Elisabeth%20%20JJ/Forms/AllItems.aspx'
WHERE slug = 'elisabeth-jj';

-- ============================================
-- Fix any remaining NULL task statuses
-- ============================================
UPDATE tasks SET status = 'completed' WHERE completed = true AND status IS NULL;
UPDATE tasks SET status = 'in_progress' WHERE completed = false AND status IS NULL;
