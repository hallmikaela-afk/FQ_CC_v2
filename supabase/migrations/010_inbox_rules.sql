-- ─────────────────────────────────────────────────────────────────────────────
-- 010_inbox_rules.sql
-- Inbox dismiss rules: hide emails by sender address or domain
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inbox_rules (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type  TEXT        NOT NULL CHECK (rule_type IN ('sender', 'domain')),
  value      TEXT        NOT NULL,        -- e.g. "someone@example.com" or "example.com"
  action     TEXT        NOT NULL DEFAULT 'hide' CHECK (action IN ('hide')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inbox_rules_type_value_unique UNIQUE (rule_type, value)
);

CREATE INDEX IF NOT EXISTS inbox_rules_value_idx ON public.inbox_rules (value);
