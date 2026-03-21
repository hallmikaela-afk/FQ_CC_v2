-- Project file attachments (photos, screenshots, emails)
create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text not null,
  public_url text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists project_files_project_id_idx on project_files(project_id);

-- Storage bucket for project files (run in Supabase dashboard if not using migrations)
-- insert into storage.buckets (id, name, public) values ('project-files', 'project-files', true)
-- on conflict (id) do nothing;
