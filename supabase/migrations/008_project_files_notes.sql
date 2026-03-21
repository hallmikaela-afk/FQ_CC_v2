-- Add notes and google_drive_path to project_files
alter table project_files
  add column if not exists notes text,
  add column if not exists google_drive_path text;
