create table sprint_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  bucket text not null,
  tag text check (tag in ('action', 'decision', 'creative', 'ops', 'marketing', 'build', 'client', 'check')) not null default 'action',
  done boolean not null default false,
  sprint_week text not null, -- ISO week e.g. "2026-W12"
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table sprint_tasks enable row level security;
create policy "allow all" on sprint_tasks for all using (true);
