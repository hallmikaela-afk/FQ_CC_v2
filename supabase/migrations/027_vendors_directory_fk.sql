-- Fox & Quinn — Link per-project vendors to global directory
-- Nullable FK: when set, VendorTile links to the vendor's directory page

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS directory_vendor_id UUID REFERENCES vendor_directory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_directory_vendor_id ON vendors(directory_vendor_id);
