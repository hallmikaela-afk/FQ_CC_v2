-- ─────────────────────────────────────────────────────────────────────────────
-- 009_email_integration.sql
-- Microsoft Graph / Outlook email integration tables
-- ─────────────────────────────────────────────────────────────────────────────

-- microsoft_tokens: stores OAuth tokens per user
CREATE TABLE IF NOT EXISTS public.microsoft_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL DEFAULT 'default',
  access_token TEXT        NOT NULL,
  refresh_token TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  scope        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT microsoft_tokens_user_id_unique UNIQUE (user_id)
);

-- emails: local cache of synced Outlook messages
CREATE TABLE IF NOT EXISTS public.emails (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       TEXT        NOT NULL,
  subject          TEXT,
  from_name        TEXT,
  from_email       TEXT,
  body_preview     TEXT,
  body             TEXT,
  received_at      TIMESTAMPTZ,
  is_read          BOOLEAN     NOT NULL DEFAULT FALSE,
  project_id       UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  match_confidence TEXT        CHECK (match_confidence IS NULL OR match_confidence IN ('exact', 'high', 'suggested', 'thread')),
  conversation_id  TEXT,
  folder_id        TEXT,
  needs_followup   BOOLEAN     NOT NULL DEFAULT FALSE,
  followup_due_date DATE,
  is_meeting_summary BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT emails_message_id_unique UNIQUE (message_id)
);

-- mail_folders: cached Outlook folder list
CREATE TABLE IF NOT EXISTS public.mail_folders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id        TEXT        NOT NULL,
  display_name     TEXT        NOT NULL,
  total_count      INTEGER     NOT NULL DEFAULT 0,
  unread_count     INTEGER     NOT NULL DEFAULT 0,
  parent_folder_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mail_folders_folder_id_unique UNIQUE (folder_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS emails_received_at_idx    ON public.emails (received_at DESC);
CREATE INDEX IF NOT EXISTS emails_project_id_idx     ON public.emails (project_id);
CREATE INDEX IF NOT EXISTS emails_conversation_id_idx ON public.emails (conversation_id);
CREATE INDEX IF NOT EXISTS emails_folder_id_idx      ON public.emails (folder_id);
CREATE INDEX IF NOT EXISTS emails_from_email_idx     ON public.emails (from_email);
CREATE INDEX IF NOT EXISTS emails_needs_followup_idx ON public.emails (needs_followup) WHERE needs_followup = TRUE;
