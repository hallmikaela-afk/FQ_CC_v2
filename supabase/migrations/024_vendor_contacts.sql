-- Fox & Quinn — Vendor Contacts
-- Multiple points of contact per vendor, with primary star support

CREATE TABLE vendor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor_directory(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vendor_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON vendor_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_vendor_contacts_vendor_id ON vendor_contacts(vendor_id);
