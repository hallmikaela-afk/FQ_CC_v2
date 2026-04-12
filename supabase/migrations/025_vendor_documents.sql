-- Fox & Quinn — Vendor Documents
-- Drive links attached to a vendor record; no files are moved or renamed automatically

CREATE TABLE vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor_directory(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  drive_url TEXT,
  drive_file_id TEXT,
  doc_type TEXT NOT NULL DEFAULT 'Other',
  status TEXT NOT NULL DEFAULT 'Unsigned' CHECK (status IN ('Unsigned', 'Executed', 'Superseded', 'Archived')),
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON vendor_documents FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_vendor_documents_vendor_id ON vendor_documents(vendor_id);
