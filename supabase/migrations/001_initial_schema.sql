-- Fox & Quinn Command Center — Initial Schema
-- Run this in Supabase SQL Editor to create all tables

-- ============================================
-- TEAM MEMBERS
-- ============================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PROJECTS (clients, shoots, proposals)
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE, -- human-readable slug like 'julia-frank'
  type TEXT NOT NULL CHECK (type IN ('client', 'shoot', 'proposal')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'proposal_sent', 'completed', 'archived')),
  event_date DATE,
  contract_signed_date DATE,
  color TEXT DEFAULT '#8B6F4E',
  concept TEXT,
  -- Client-specific
  service_tier TEXT,
  client1_name TEXT,
  client2_name TEXT,
  venue_name TEXT,
  venue_location TEXT,
  venue_street TEXT,
  venue_city_state_zip TEXT,
  client1_email TEXT,
  client2_email TEXT,
  client1_phone TEXT,
  client2_phone TEXT,
  client_street TEXT,
  client_city_state_zip TEXT,
  guest_count INTEGER,
  estimated_budget TEXT,
  -- Shoot-specific
  photographer TEXT,
  florist TEXT,
  location TEXT,
  location_street TEXT,
  location_city_state_zip TEXT,
  -- Links & Resources
  design_board_link TEXT,
  canva_link TEXT,
  internal_file_share TEXT,
  client_shared_folder TEXT,
  client_portal_link TEXT,
  client_website TEXT,
  sharepoint_folder TEXT,
  -- Project colors palette (stored as JSON array)
  project_colors JSONB DEFAULT '[]',
  -- Next call agenda (stored as JSON array)
  next_call_agenda JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PROJECT ↔ TEAM MEMBER assignments
-- ============================================
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  UNIQUE(project_id, team_member_id)
);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('in_progress', 'delayed', 'completed')),
  due_date DATE,
  category TEXT,
  assigned_to UUID REFERENCES team_members(id),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SUBTASKS
-- ============================================
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- VENDORS (per-project)
-- ============================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  instagram TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CALL NOTES
-- ============================================
CREATE TABLE call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT,
  summary TEXT,
  raw_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- EXTRACTED ACTIONS (from call notes)
-- ============================================
CREATE TABLE extracted_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_note_id UUID NOT NULL REFERENCES call_notes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_date DATE,
  accepted BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false
);

-- ============================================
-- TEMPLATE TASKS (for new client onboarding)
-- ============================================
CREATE TABLE template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  weeks_before_event INTEGER NOT NULL, -- how many weeks before event_date
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_vendors_project ON vendors(project_id);
CREATE INDEX idx_call_notes_project ON call_notes(project_id);
CREATE INDEX idx_extracted_actions_call_note ON extracted_actions(call_note_id);
CREATE INDEX idx_project_assignments_project ON project_assignments(project_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DEFAULT TEMPLATE TASKS
-- ============================================
INSERT INTO template_tasks (text, category, weeks_before_event, sort_order) VALUES
  -- Onboarding (40+ weeks out)
  ('Send welcome packet & questionnaire', 'Onboarding', 40, 1),
  ('Schedule kickoff call', 'Onboarding', 39, 2),
  ('Create wedding website', 'Onboarding', 38, 3),
  ('Set up shared planning folder', 'Onboarding', 38, 4),
  -- Venue & Key Vendor Search (35-28 weeks)
  ('Confirm venue contract & deposit', 'Venue & Key Vendor Search', 35, 5),
  ('Book photographer', 'Venue & Key Vendor Search', 34, 6),
  ('Book videographer', 'Venue & Key Vendor Search', 33, 7),
  ('Book florist', 'Venue & Key Vendor Search', 32, 8),
  ('Book caterer or confirm venue catering', 'Venue & Key Vendor Search', 31, 9),
  ('Book band or DJ', 'Venue & Key Vendor Search', 30, 10),
  ('Book hair & makeup artist', 'Venue & Key Vendor Search', 30, 11),
  ('Book hotel room blocks', 'Venue & Key Vendor Search', 28, 12),
  -- Stationery (28-16 weeks)
  ('Design & send save-the-dates', 'Stationery', 28, 13),
  ('Design invitation suite', 'Stationery', 20, 14),
  ('Send invitations', 'Stationery', 16, 15),
  -- Florals & Decor (20-12 weeks)
  ('Finalize floral palette & vision', 'Florals & Decor', 20, 16),
  ('Select table linens & rentals', 'Florals & Decor', 18, 17),
  ('Review floral mockup', 'Florals & Decor', 14, 18),
  ('Finalize ceremony decor plan', 'Florals & Decor', 12, 19),
  -- Entertainment (16-10 weeks)
  ('Finalize ceremony music selections', 'Entertainment', 16, 20),
  ('Confirm cocktail hour music', 'Entertainment', 14, 21),
  ('Create reception playlist / requests', 'Entertainment', 10, 22),
  -- Hair & Makeup (12-6 weeks)
  ('Schedule hair & makeup trial', 'Hair & Makeup', 12, 23),
  ('Complete hair & makeup trial', 'Hair & Makeup', 8, 24),
  ('Finalize hair & makeup timeline for wedding day', 'Hair & Makeup', 6, 25),
  -- Logistics (10-1 weeks)
  ('Draft day-of timeline v1', 'Logistics', 10, 26),
  ('Coordinate rental delivery & pickup', 'Logistics', 8, 27),
  ('Confirm transportation / shuttles', 'Logistics', 6, 28),
  ('Final venue walkthrough', 'Logistics', 4, 29),
  ('Finalize day-of timeline', 'Logistics', 3, 30),
  ('Distribute final timeline to vendors', 'Logistics', 2, 31),
  ('Confirm all vendor arrival times', 'Logistics', 1, 32),
  -- Check in - Client (ongoing)
  ('Check in call with client (6 months)', 'Check in - Client', 26, 33),
  ('Check in call with client (4 months)', 'Check in - Client', 17, 34),
  ('Collect dietary restrictions from RSVPs', 'Check in - Client', 10, 35),
  ('Schedule timeline call', 'Check in - Client', 8, 36),
  ('Final check in call (2 weeks)', 'Check in - Client', 2, 37),
  -- Photography (20-4 weeks)
  ('Schedule engagement shoot', 'Photography', 20, 38),
  ('Create shot list for wedding day', 'Photography', 6, 39),
  ('Confirm photographer timeline', 'Photography', 4, 40);

-- ============================================
-- ROW LEVEL SECURITY (basic — allow all for now)
-- ============================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anon users (tighten later)
CREATE POLICY "Allow all" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON project_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON subtasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON call_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON extracted_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON template_tasks FOR ALL USING (true) WITH CHECK (true);
