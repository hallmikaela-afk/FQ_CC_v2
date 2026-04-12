-- Fox & Quinn — Global Vendor Directory
-- Standalone vendor records shared across all projects (not per-project)

CREATE TABLE vendor_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  category TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  instagram TEXT,
  website TEXT,
  notes TEXT,
  ai_summary TEXT,
  ai_summary_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reuse the existing update_updated_at() function from migration 001
CREATE TRIGGER vendor_directory_updated_at
  BEFORE UPDATE ON vendor_directory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE vendor_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON vendor_directory FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_vendor_directory_category ON vendor_directory(category);
CREATE INDEX idx_vendor_directory_name ON vendor_directory(name);
