# FQ Command Center — Weekend Sprint Plan & Testing Protocol

**Sprint dates:** Saturday June 13 – Sunday June 14, 2026
**Source:** Full codebase audit of `main` (June 12) + Tactical Change Log
**Goal:** Clear every confirmed-broken item so the next phases (7–9) build on solid ground.

---

## How to run this sprint

One rule, learned from the 18 abandoned branches: **land everything you start.**

For each block below:

1. Start a fresh Claude Code session on a new branch off latest `main`.
2. Paste the prompt for that block.
3. Run the testing protocol for that block (below) against the preview deploy.
4. Merge to `main`, confirm Vercel deploys, re-test live.
5. Delete the branch. Then — and only then — start the next block.

Each block is sized for one 2–3 hour session. Four blocks over the weekend is the full plan; three is still a great weekend.

---

## Friday night / Saturday first coffee — Pre-sprint setup (30 min, no code)

These rule out "ghost bugs" before you spend sessions on them.

- [ ] **Delete the 18 stale branches** at github.com/hallmikaela-afk/FQ_CC_v2/branches (keep `main` and `claude/dreamy-sagan-puylsk`). Recovery SHAs if ever needed: `1ecb4b4` (vendor-directory), `5a64680` (fix-ai-setup), `9e4075f` (drive-chat-access).
- [ ] **Verify Vercel is deploying latest main.** In Vercel → Deployments, confirm the production deploy commit is `f362f59`. If not, redeploy.
- [ ] **Stale-deployment check.** On the live app, test these three features the audit found already built. If any fail live but exist in code, the problem is deployment, not code:
  - Vendor credits popout in email reply toolbar → should show checkboxes per vendor, insert a bulleted list with Instagram links
  - Tasks page → New Task form has a project dropdown
  - Tasks page → clicking a status/priority pill opens an inline editor
- [ ] **Enable Supabase automated backups** (Supabase dashboard → Database → Backups). This was already on your build plan's Immediate Next Steps and you're about to change schema this weekend.

---

## SATURDAY

### Block 1 — Stability core: login bug, event-day crash, data-model cleanup

The foundation block. Everything else assumes this is done.

**Paste into Claude Code:**

> Three related stability fixes, one branch, in this order:
>
> 1. **Resolve the committed merge conflict in CLAUDE.md (lines 131–137).** Keep the HEAD version (Design A: `vendors.event_day_id` NOT NULL, primary day row with `sort_order=0` auto-created per project) — that is what the database actually enforces after migration 021.
>
> 2. **Fix the event-day delete crash.** Migration `019_event_days.sql:19` made the vendors FK `ON DELETE SET NULL`, but migration `021_fix_primary_event_day.sql:26` made the column NOT NULL — so deleting an event day that has vendors throws a constraint violation. Write migration 023 that changes the FK to `ON DELETE CASCADE`. Note migrations 018 and 019 each have two files — number the new one 023 to be safe. Update the DELETE handler comment in `src/app/api/event-days/route.ts` and keep the AddEventDayModal warning text ("this will remove all vendors for this day") accurate.
>
> 3. **Purge the leftover Design B (nullable event_day_id) code paths:** `src/components/inbox/EmailDetail.tsx:878, 1441, 2009` (null-checks/filters for `!v.event_day_id` that can never match), `src/app/projects/[id]/page.tsx:705, 846` (can still send `event_day_id: null` to /api/vendors, which the DB now rejects — make the vendors API return a clear 400 if event_day_id is missing, and make the UI always resolve the primary day id). Align `src/data/seed.ts` Vendor type with `src/lib/database.types.ts:160` (non-nullable).
>
> 4. **Fix session persistence (login-every-time bug).** Implement the standard @supabase/ssr middleware pattern in `src/middleware.ts`: refresh the session (getUser) and write refreshed auth cookies onto the response instead of redirecting the moment the access token is expired. In `src/components/LayoutWrapper.tsx:15-25`: use the shared client from `getSupabase()` instead of creating a new one, call `getSession()` on mount, and handle `SIGNED_OUT` (redirect to /login). Do not change RLS or auth providers.
>
> Run `npx tsc --noEmit` and `npx next build` before finishing.

**Testing protocol — Block 1:**

- [ ] Log in, close the browser tab entirely, reopen the app → lands on dashboard, **no login prompt**
- [ ] Leave the app idle 90+ minutes (access token expiry), then click around → still logged in
- [ ] Log out → redirected to /login; protected pages redirect to /login when logged out
- [ ] Open a project → add a second event day → add a vendor to that day → **delete that event day** → no error; day and its vendors gone; primary day untouched
- [ ] Add a vendor to the primary day with all fields → saves and displays
- [ ] Vendor credits popout in inbox still groups correctly by event day
- [ ] CLAUDE.md has no `<<<<<<<` markers (search the file)

---

### Block 2 — Silent failures: email send trust + All Mail filter + upload errors

The "can I trust what the app tells me" block.

**Paste into Claude Code:**

> Fix every silent-failure path found in audit, plus the All Mail project filter:
>
> 1. **Reply send** (`src/components/inbox/EmailDetail.tsx:1751-1763`): the fetch to /api/emails/reply never checks the response — UI shows "Reply sent" even on 401/500. Check `res.ok`, surface the API error message in the UI (FQ-styled inline error, not alert()), and only set sent state on success. Apply the same pattern to the compose send path in ComposePanel and the bulk reassign call (`src/app/inbox/page.tsx:806`).
> 2. **Initial sync progress** (`src/app/inbox/page.tsx:351-376`): check `res.ok` before parsing the stream; on failure show an error state instead of "Loading email history… 0 emails" forever.
> 3. **Project filter on All Mail** (`src/app/inbox/page.tsx:497-532`, esp. line 524): when a project filter is set on the All Mail tab, only that project's emails should show. Add a `project_id` query param to GET /api/emails (`src/app/api/emails/route.ts:88-103`) so the filter is server-side, and pass it from the inbox page.
> 4. **Upload errors** (`src/app/api/project-files/route.ts:62-82`, `src/components/UploadModal.tsx:127-133`): validate file size client-side before POST with a clear message (Vercel API routes reject large bodies — cap at 4MB and say so, or move large uploads to Supabase Storage direct upload), and return specific error messages from the route instead of a generic catch.
> 5. **PDF parse failures** (`src/app/api/parse-file/route.ts:66-96`, `src/components/FloatingChat.tsx:182-192`): when a PDF yields no text (scanned/image PDF), return an explicit warning ("This PDF appears to be a scanned image — no text could be extracted") and surface it in the UI instead of silently skipping the file.
>
> Run `npx tsc --noEmit` and `npx next build` before finishing.

**Testing protocol — Block 2:**

- [ ] Send a reply to yourself → "sent" appears AND the email arrives in your inbox
- [ ] Disconnect Outlook (revoke or let token lapse), try to reply → **visible error**, not "Reply sent"
- [ ] All Mail tab + project filter "Julia & Frank" → only J&F emails, no untagged leakage; clear filter → everything returns
- [ ] Bulk-select two emails → File to Project → both move; check the same emails in Outlook moved folders
- [ ] Upload a small PDF from computer → succeeds, appears in project files
- [ ] Upload a 10MB+ file → clear size-limit message, not a hang or cryptic failure
- [ ] Upload your vendor PDF that failed before → either parses, or tells you exactly why (scanned image)

---

## SUNDAY

### Block 3 — Inbox completeness: attachments + AI draft context + compose links

The "inbox actually does what the build plan says" block.

**Paste into Claude Code:**

> Three inbox gaps:
>
> 1. **Attachment list in email view.** `/api/emails/attachments` exists but EmailDetail never calls it. In EmailDetail, when `email.has_attachments` is true, fetch and render the attachment list (filename, size, download, and the existing eye-icon inline preview via /api/emails/attachments/convert). Make the paperclip indicator on EmailCard (`src/components/inbox/EmailCard.tsx:350`) more visible using fq- tokens.
> 2. **AI draft context for untagged emails.** `src/lib/generateEmailDraft.ts:35` only builds project context if the email already has a project_id, and the draft flow runs before triage. When drafting from an untagged email, prompt for a project first (small FQ-styled picker, with a "no project" option), then generate with that project's context (tasks, vendors, call notes).
> 3. **Hyperlinks in new compose.** LinkModal exists in EmailDetail (lines 758-870) but ComposePanel has no link insertion. Port LinkModal into ComposePanel's toolbar, preserving selection handling.
>
> Don't make EmailDetail.tsx larger — extract new pieces into components under src/components/inbox/. Run `npx tsc --noEmit` and `npx next build`.

**Testing protocol — Block 3:**

- [ ] Open an email with attachments → list shows with names/sizes; preview works for PDF, image, DOCX, XLSX; download works
- [ ] Email list shows a clearly visible attachment indicator on those emails
- [ ] Open an **untagged** email → Draft Response → project picker appears → pick Julia & Frank → draft references real J&F context (venue, vendors, or tasks)
- [ ] Compose a brand-new email → select text → insert link → link present in received email
- [ ] Reply draft LinkModal still works (regression)

### Block 4 — Drive truth + week rollover + small wins

**Paste into Claude Code:**

> Four quick items:
>
> 1. **Phantom Drive folders.** The UI shows the cached 14-subfolder structure from the drive_folders table without checking Drive (`src/app/api/drive/files/route.ts:31-46`, `src/components/Sidebar.tsx:129-147`). Change /api/drive/files to list what actually exists in Drive (handle 404 = folder deleted → show empty + a "provision folders" affordance). Auto-provisioning the folder set should only happen on new project creation, never retroactively displayed for projects that don't have them (e.g. Menorca).
> 2. **Drive flyout scroll.** `src/components/drive/SidebarDriveFlyout.tsx:124-145` — the flyout's computed max-height can collapse near the bottom of the viewport. Give the list a sane minimum height and reposition upward when space is short.
> 3. **Bulk week rollover.** On /week, add "Move incomplete to next week" (FQ voice, no exclamation points) that takes all `done: false` sprint tasks in the current week to the next ISO week, with a count confirmation. Per-task push already exists (`src/app/week/page.tsx:116-133`) — reuse its logic.
> 4. **API client hygiene.** Switch the five API routes importing the anon `supabase` proxy to `getServiceSupabase()`: tasks, sprint-tasks, projects, subtasks, template-tasks (each at line 2). No RLS changes.
>
> Run `npx tsc --noEmit` and `npx next build`.

**Testing protocol — Block 4:**

- [ ] Sidebar Drive flyout for Menorca → shows only folders that truly exist in Drive (verify against drive.google.com side by side)
- [ ] Create a throwaway test project → 14 subfolders provisioned in Drive AND visible in app → archive/delete the test project after
- [ ] Open Drive flyout on the bottom-most project in the sidebar → list scrolls, all folders reachable
- [ ] Week page with 3+ unfinished tasks → "Move incomplete to next week" → confirm → tasks appear in next week, done tasks stay
- [ ] Regression after the client swap: create/edit/complete a task; add a sprint task; create a test project; templates load on new client

---

## End-of-weekend regression smoke test (15 min, on production)

Run once after the last merge deploys:

- [ ] Login → dashboard loads with all 5 project cards
- [ ] Close browser, reopen → still logged in
- [ ] Open each project page → tasks, vendors, event days, files render
- [ ] Inbox → folders load, emails load, open an email, reply to yourself, receive it
- [ ] Mark an email Needs Follow-up → thread siblings dismiss
- [ ] Upload one file from computer; open one Drive folder
- [ ] Week page → add a task, complete a task
- [ ] Floating chat → ask "what's on my plate this week" → sensible answer
- [ ] No console errors on dashboard, inbox, or a project page (F12 → Console)

---

## Deliberately NOT this weekend (next sprint)

In priority order, with why they can wait:

1. **API route auth** (routes are publicly callable) — needs a design decision on session checking; required before Team Access (Phase 14), not before solo use. *Exception: the client-swap in Block 4 is the safe half of this and is included.*
2. **Inbox rules with assign-to-project actions** (your Canva→Marketing case) — schema + UI work, pairs naturally with the AI Triage Agent (Phase 11).
3. **Drag-and-drop email filing** — UX feature, builds on the now-trustworthy reassign path from Block 2.
4. **Add-vendor quick action from any email** — small feature; pairs with Vendor Directory (Phase 8).
5. **Pattern detection → rule suggestions** — largest build; belongs inside Phase 11.
6. **Hardcoded sender identity in compose route; Outlook move retry logic; search from-filter OR/AND mismatch** — real but low-impact; batch into Phase 13 (Error Handling & Stability).

---

*Calm is the luxury. One branch at a time, merged and verified, beats five branches of unfinished brilliance.*
