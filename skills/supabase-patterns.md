# FQ Supabase Patterns Skill

Read this before making ANY database changes,
writing queries, or adding new tables.

---

## Two Clients — Know Which to Use

### `supabase` (client-side, anon key)
```typescript
import { supabase } from '@/lib/supabase';
```
Use in: React components, hooks, client-side code
Respects Row Level Security (RLS)
Has access to auth session

### `getServiceSupabase()` (server-side, service role)
```typescript
import { getServiceSupabase } from '@/lib/supabase';
const supabase = getServiceSupabase();
```
Use in: API routes (`/api/**`), server-side sync
Bypasses RLS — has full database access
Never use in client-side code
Never expose the service role key to the browser

---

## The Wrong Client Is a Silent Bug

Using `supabase` (anon) in an API route when 
RLS is enabled will return empty results with 
no error. Always use `getServiceSupabase()` 
in API routes.

---

## Standard Query Patterns

### Fetch with error handling
```typescript
const { data, error } = await supabase
  .from('projects')
  .select('id, name, status')
  .eq('status', 'active')
  .order('event_date');

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

### Upsert (insert or update)
```typescript
const { data, error } = await supabase
  .from('emails')
  .upsert(
    { message_id: '123', subject: 'Hello', project_id: null },
    { onConflict: 'message_id' }
  )
  .select();
```

### Single row fetch
```typescript
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('id', projectId)
  .single(); // throws if 0 or 2+ rows

// Use maybeSingle() if row might not exist
const { data } = await supabase
  .from('emails')
  .select('*')
  .eq('id', emailId)
  .maybeSingle(); // returns null if not found
```

---

## Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `projects` | Clients and shoots | id, slug, type, name, status, event_date, outlook_folder_id |
| `tasks` | All project tasks | id, project_id, text, completed, due_date, category, priority |
| `sprint_tasks` | My Week sprint items | id, project_id, task, bucket, tag, week_of |
| `vendors` | Vendor contacts | id, project_id, vendor_name, email, category |
| `emails` | Cached Outlook emails | id, message_id, project_id, match_confidence, dismissed, resolved |
| `mail_folders` | Outlook folder cache | id, folder_id, display_name, unread_count |
| `microsoft_tokens` | OAuth tokens | id, user_id, access_token, refresh_token, expires_at |
| `call_notes` | Zoom/call summaries | id, project_id, date, summary, raw_text |
| `extracted_actions` | AI action items from calls | id, call_note_id, text, due_date, accepted |
| `project_files` | Uploaded file metadata | id, project_id, file_name, storage_path |
| `template_tasks` | Task templates for new clients | id, text, category, weeks_before_event |
| `team_members` | Tim, Liliana, Mikaela | id, name, initials, role |

---

## Adding New Columns

Always create a migration file:

1. Go to `supabase/migrations/`
2. Create `{number}_{description}.sql`
   e.g. `015_add_google_drive_folder.sql`
3. Write the ALTER TABLE statement:
```sql
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS google_drive_folder_id text;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS google_drive_folder_url text;
```
4. Update `src/lib/database.types.ts` to match

Never modify production schema without a migration file.

---

## Adding New Tables
```sql
CREATE TABLE IF NOT EXISTS new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON new_table
  FOR ALL USING (true);
```

---

## The emails Table — Special Notes

- `message_id` is the unique Outlook message ID — use as upsert conflict key
- `dismissed = true` means hide from Command Center (not deleted from Outlook)
- `resolved = true` means action complete — keep in history
- `match_confidence` drives UI display — never set manually to 'exact' unless it truly is
- `category = 'receipt'` means auto-filed to Receipts folder

---

## Bulk Operations

For bulk inserts/upserts, batch in groups of 
10 to avoid hitting Supabase limits:
```typescript
const BATCH_SIZE = 10;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  await supabase.from('emails').upsert(batch, { onConflict: 'message_id' });
}
```

---

## Never Do This
```typescript
// Never delete all rows without a WHERE clause
await supabase.from('emails').delete(); // DANGEROUS

// Always scope deletes
await supabase.from('emails').delete().eq('dismissed', true);
```
