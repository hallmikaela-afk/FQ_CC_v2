-- Migration 018: Google Drive integration
-- Creates google_tokens and drive_folders tables

-- Store Google OAuth tokens (single-user pattern, userId = 'default')
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all google_tokens" ON google_tokens FOR ALL USING (true) WITH CHECK (true);

-- Store Drive folder IDs per project
CREATE TABLE IF NOT EXISTS drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  root_folder_id TEXT NOT NULL,         -- "Julia & Frank — Fox & Quinn"
  root_folder_url TEXT NOT NULL,
  internal_folder_id TEXT NOT NULL,     -- "Internal — Julia & Frank"
  internal_folder_url TEXT NOT NULL,
  client_folder_id TEXT NOT NULL,       -- "Client Shared — Julia & Frank"
  client_folder_url TEXT NOT NULL,
  subfolder_ids JSONB NOT NULL DEFAULT '{}',  -- { "Budgets": "folder_id", ... }
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE drive_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all drive_folders" ON drive_folders FOR ALL USING (true) WITH CHECK (true);
