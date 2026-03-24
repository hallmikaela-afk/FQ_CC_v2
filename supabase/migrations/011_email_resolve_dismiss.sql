-- ─────────────────────────────────────────────────────────────────────────────
-- 011_email_resolve_dismiss.sql
-- Add resolved, dismissed, category, draft_message_id to emails table
-- ─────────────────────────────────────────────────────────────────────────────

-- dismissed: true = not a project email, hide completely from main view
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- category: 'receipt' | NULL — used to mark subscription receipts
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS category TEXT;

-- draft_message_id: Graph message ID of an in-progress reply draft
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS draft_message_id TEXT;

-- resolved: true = project email, action complete, kept in history
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_emails_dismissed ON public.emails (dismissed) WHERE dismissed = TRUE;
CREATE INDEX IF NOT EXISTS idx_emails_resolved  ON public.emails (resolved)  WHERE resolved  = TRUE;
