-- ─────────────────────────────────────────────────────────────────────────────
-- 019_security_fixes.sql
-- Fix Supabase security advisor warnings:
--   1. Function search_path mutable on update_updated_at
--   2. RLS disabled on microsoft_tokens, emails, mail_folders, inbox_rules
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Fix search_path on the update_updated_at trigger function
--    This prevents potential search_path injection attacks.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Enable RLS on email/token tables that were missing it,
--    and add the same permissive "Allow all" policy used everywhere else.
--    This is intentional for a single-user app — see CLAUDE.md.

ALTER TABLE public.microsoft_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'microsoft_tokens'
      AND policyname = 'Allow all microsoft_tokens'
  ) THEN
    CREATE POLICY "Allow all microsoft_tokens"
      ON public.microsoft_tokens
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'emails'
      AND policyname = 'Allow all emails'
  ) THEN
    CREATE POLICY "Allow all emails"
      ON public.emails
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.mail_folders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'mail_folders'
      AND policyname = 'Allow all mail_folders'
  ) THEN
    CREATE POLICY "Allow all mail_folders"
      ON public.mail_folders
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.inbox_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'inbox_rules'
      AND policyname = 'Allow all inbox_rules'
  ) THEN
    CREATE POLICY "Allow all inbox_rules"
      ON public.inbox_rules
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
