# FQ Command Center — CLAUDE.md

> Working context for Claude Code. Read this before touching any file.

---

## What this app is

The **Fox & Quinn Command Center** is a private, single-user operations hub for Mikaela Hall, founder and creative director of Fox & Quinn (a luxury wedding planning and design studio). It replaces spreadsheets, scattered notes, and disconnected tools with one place to manage clients, shoots, tasks, email, and weekly planning.

This is a real production app — not a prototype. Changes affect live data. Build with care.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, `src/` directory) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS with custom FQ design tokens |
| Database | Supabase (Postgres + Auth) |
| Email | Microsoft Graph API (Outlook OAuth) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Deployment | Vercel |
| File parsing | mammoth (docx), pdfjs-dist, xlsx |

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY         # Service role key — bypasses RLS, server-side only
ANTHROPIC_API_KEY                 # Claude API key — server-side only
AZURE_TENANT_ID                   # Microsoft OAuth tenant
AZURE_CLIENT_ID                   # Microsoft OAuth app client ID
AZURE_CLIENT_SECRET               # Microsoft OAuth app secret
NEXTAUTH_URL / NEXT_PUBLIC_APP_URL # App base URL for OAuth callbacks
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   # Google Maps JS API — enables Places Autocomplete in AddEventDayModal (falls back to plain text if absent). Requires Maps JavaScript API + Places API enabled in Google Cloud Console. Must also be set in Vercel project environment variables.
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or Azure secrets to the client. They are server-only.

---

## Project structure

```
src/
  app/
    page.tsx                  # Dashboard (project cards grid)
    layout.tsx                # Root layout with LayoutWrapper
    login/page.tsx            # Supabase email/password login
    projects/
      page.tsx                # Projects list
      [id]/page.tsx           # Individual project detail (LARGE — ~111KB)
    tasks/page.tsx            # Cross-project task board
    week/page.tsx             # Weekly sprint board ("My Week")
    inbox/page.tsx            # Outlook inbox (LARGE — ~52KB)
    assistant/page.tsx        # Full-page AI chat
    import/page.tsx           # Data import tool
    api/
      assistant/route.ts      # Claude API endpoint — builds context from Supabase
      auth/microsoft/         # OAuth login, callback, status
      emails/                 # Sync, compose, reply, draft, triage, search, folders
      projects/               # CRUD + Outlook folder sync
      tasks/ subtasks/        # CRUD
      vendors/                # CRUD
      call-notes/             # CRUD
      sprint-tasks/           # CRUD + AI chat for week planning
      project-files/          # Upload/list
      inbox-rules/            # Auto-triage rules
      import/                 # Bulk data import
      event-days/             # Full CRUD for event_days table. Supports slug-to-UUID resolution. Every project must have at least one event day row (the primary day).
      parse-file/             # Server-side file parsing (pdf, docx, xlsx)
      team/                   # Team member list
      template-tasks/         # Task templates for new clients
  components/
    Sidebar.tsx               # Collapsible nav with project dropdown
    LayoutWrapper.tsx         # Wraps all pages with sidebar
    ClientCard.tsx            # Dashboard card for weddings
    ShootCard.tsx             # Dashboard card for editorial shoots
    FloatingChat.tsx          # Persistent floating AI chat bubble
    WeekChatPanel.tsx         # AI chat panel on week page
    AddEventDayModal.tsx      # Modal to add/edit event days with Google Maps Places Autocomplete
    ProjectFileUpload.tsx     # File upload for project documents
    UploadModal.tsx           # Upload modal
    QuickUploadButton.tsx     # Quick upload trigger
    inbox/
      EmailDetail.tsx         # Full email view (LARGE — ~86KB)
      EmailCard.tsx           # Email list item
      ComposePanel.tsx        # Compose/reply panel
      FolderSidebar.tsx       # Outlook folder tree
      AddressField.tsx        # To/CC/BCC autocomplete
  lib/
    supabase.ts               # getSupabase() (client), getServiceSupabase() (server)
    auth.ts                   # getSession(), signIn(), signOut()
    microsoft-graph.ts        # Token management + Graph API helpers
    database.types.ts         # TypeScript types for all Supabase tables
    hooks.ts                  # React hooks for data fetching
    email-matching.ts         # Logic to match emails to projects
    email-sync-helpers.ts     # Email sync utilities
    emailSignature.ts         # FQ email signature
    generateEmailDraft.ts     # AI draft generation helper
    week.ts                   # ISO week utilities
  data/
    seed.ts                   # Type definitions, formatting helpers, seed data
  middleware.ts               # Auth guard — redirects unauthenticated users to /login
supabase/
  migrations/                 # All schema changes in numbered order (001–022)
```

---

## Database schema (Supabase)

### Core tables
- **projects** — clients, shoots, proposals. `type`: `client | shoot | proposal`. `status`: `active | completed | archived`. Has slug for URL routing.
- **tasks** — per-project tasks. `status`: `in_progress | delayed | completed`. Has `sort_order`, `function_roles`, `priority`.
- **subtasks** — children of tasks.
- **team_members** — Mikaela's team (currently: Mikaela, Liliana VanMiddlesworth, Tim).
- **project_assignments** — many-to-many projects ↔ team_members.
- **vendors** — per-project vendor contacts (category, name, email, phone, instagram). `event_day_id` FK → event_days (NOT NULL — always points to a real event day row).
- **event_days** — additional event days per project (rehearsal dinner, ceremony, reception, etc.). Fields: `day_name`, `event_date`, `venue_name`, `venue_street`, `venue_city_state_zip`, `sort_order`. A primary/wedding day row (`sort_order = 0`) is always created automatically when a project is created.
- **call_notes** — raw + summarized notes from client/vendor calls.
- **extracted_actions** — AI-extracted action items from call notes.
- **template_tasks** — reusable task templates keyed by `weeks_before_event`.
- **sprint_tasks** — weekly sprint board tasks with `bucket`, `tag`, `sprint_week` (ISO format: `YYYY-Www`), `done`.
- **project_files** — uploaded files per project, stored in Supabase Storage.

### Email tables (migration 009+)
- **emails** — cached Outlook messages. Has `project_id` FK (nullable), `match_confidence`, `needs_followup`, `conversation_id`, `folder_id`.
- **mail_folders** — cached Outlook folder tree.
- **microsoft_tokens** — OAuth tokens per `user_id` (currently single user: `'default'`).

### RLS
RLS is enabled on all tables but currently uses permissive `Allow all` policies. This is intentional for now — the app is single-user behind Supabase Auth. Do not tighten RLS policies without discussing first.

---

## Supabase client usage

Two clients — use the right one:

```ts
// Client-side (browser) — uses anon key, respects RLS
import { getSupabase } from '@/lib/supabase';

// Server-side (API routes) — uses service role, bypasses RLS
import { getServiceSupabase } from '@/lib/supabase';
```

**Never** use `getServiceSupabase()` in client components. **Always** use it in API routes that write to email/token tables.

---

## Microsoft Graph / Outlook

- OAuth flow: `GET /api/auth/microsoft/login` → Microsoft → `GET /api/auth/microsoft/callback`
- Tokens stored in `microsoft_tokens` table keyed by `user_id = 'default'`
- All Graph calls go through `graphFetch()` in `src/lib/microsoft-graph.ts`
- Token refresh is automatic (5-min buffer). On 401, forces a refresh and retries once.
- Scopes: `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`
- Email sync flow: initial sync → load more → triage

---

## AI assistant

- Full-page chat: `/assistant` → `/api/assistant/route.ts`
- Floating chat bubble: `FloatingChat.tsx` → same API endpoint
- Week page AI: `WeekChatPanel.tsx` → `/api/sprint-tasks/chat/route.ts`
- Context is built fresh per request from Supabase (projects, tasks, team, sprint tasks)
- The assistant knows it's working for Mikaela at Fox & Quinn
- The assistant can read and create tasks, summarize projects, and draft emails

---

## Design system (Tailwind tokens)

All colors use the `fq-` prefix. Never use raw Tailwind color classes (gray-500, etc.) — always use the FQ tokens:

```
fq-bg           # Page background (warm off-white)
fq-card         # Card/panel background
fq-border       # Subtle border color
fq-dark         # Primary text
fq-muted        # Secondary text
fq-accent       # Brand accent (warm brown/tan)
fq-light-accent # Light accent tint
fq-blue / fq-blue-light
fq-amber / fq-amber-light
fq-plum / fq-plum-light
fq-rose / fq-rose-light
fq-sage / fq-sage-light
fq-teal / fq-teal-light
```

Typography:
- `font-heading` — display/headings
- `font-body` — all body text, labels, inputs

Brand voice in UI copy: calm, professional, restrained. No exclamation points in UI labels. No generic tech language. Match the FQ brand: "Calm is the luxury."

---

## Routing & auth

- All routes except `/login` require an authenticated Supabase session (enforced in `middleware.ts`)
- API routes under `/api/` are excluded from middleware (they handle auth internally)
- Project detail pages use `slug` as the URL param (e.g. `/projects/julia-frank`), falling back to `id`

---

## Current active projects (as of build date)

1. **Julia & Frank** — Wave Resort, NJ, June 2026 (Cinema Noir concept)
2. **Elisabeth & JJ** — LionRock Farm, CT, October 2026 (Rooted in Rhythm concept)
3. **Tippi & Justin** — Vanderbilt Museum, NY, September 2026
4. **Sun-Steeped Hamptons** — Editorial shoot, April 2026
5. **Menorca Editorial** — Shoot, May 2026

---

## Conventions & patterns

### API routes
- All in `src/app/api/*/route.ts` (Next.js App Router format)
- Use `getServiceSupabase()` for DB access
- Return `NextResponse.json({ error })` with appropriate status codes
- Export `dynamic = 'force-dynamic'` where needed

### Components
- All client components start with `'use client'`
- Data fetching uses custom hooks from `src/lib/hooks.ts`
- Modals use fixed overlay + backdrop blur pattern (see `NewClientModal` in `page.tsx` as reference)
- Icons are inline SVGs — no external icon library except `lucide-react`

### TypeScript
- Types for all DB rows live in `src/lib/database.types.ts` — update this when adding tables
- `Project`, `Task`, etc. types also exported from `src/data/seed.ts` — keep in sync

### Migrations
- New schema changes go in `supabase/migrations/` as the next numbered file (currently at `022`)
- Always use `IF NOT EXISTS` / `IF EXISTS` for safety

---

## What NOT to do

- Do not use raw Tailwind color classes — always use `fq-` tokens
- Do not use `supabase.auth` directly — use `getSession()` from `src/lib/auth.ts`
- Do not add new dependencies without asking
- Do not make `inbox/page.tsx` or `projects/[id]/page.tsx` any larger — refactor instead
- Do not expose service role key or API keys to client components
- Do not change RLS policies without discussion

---

## Roadmap (things to build next)

- Budget tracker per project
- Client-facing portal / timeline view
- Cross-project vendor CRM
- Document generator (contracts, timelines, run-of-show)
- Calendar / timeline view
- Overdue task notifications
