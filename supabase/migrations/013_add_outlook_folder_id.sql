-- Add outlook_folder_id to projects table so each project can be linked to
-- its corresponding Outlook mail folder for automatic email routing.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outlook_folder_id TEXT;
