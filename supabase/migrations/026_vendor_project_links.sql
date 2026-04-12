-- Fox & Quinn — Vendor Project Links
-- Many-to-many: vendor_directory ↔ projects

CREATE TABLE vendor_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor_directory(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, project_id)
);

ALTER TABLE vendor_project_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON vendor_project_links FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_vendor_project_links_vendor_id ON vendor_project_links(vendor_id);
CREATE INDEX idx_vendor_project_links_project_id ON vendor_project_links(project_id);
