-- ─────────────────────────────────────────────────────────────────────────────
-- 012_add_needs_response.sql
-- Add needs_response boolean to emails table for explicit "Reply Needed" flagging
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS needs_response BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_emails_needs_response ON public.emails (needs_response) WHERE needs_response = TRUE;
