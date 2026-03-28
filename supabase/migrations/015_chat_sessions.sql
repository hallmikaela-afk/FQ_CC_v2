-- Persistent chat history for all chat surfaces (assistant, floating, week)
create table if not exists chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  context    text not null check (context in ('assistant', 'floating', 'week')),
  project_id uuid references projects(id) on delete set null,
  page_context text,        -- e.g. 'week:2026-W14'
  title      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  metadata   jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists chat_sessions_context_idx  on chat_sessions(context, updated_at desc);
create index if not exists chat_messages_session_idx  on chat_messages(session_id, created_at);

alter table chat_sessions  enable row level security;
alter table chat_messages  enable row level security;

create policy "Allow all on chat_sessions"  on chat_sessions  for all using (true);
create policy "Allow all on chat_messages"  on chat_messages  for all using (true);
