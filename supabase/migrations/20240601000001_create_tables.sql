-- ──────────────────────────────────────────────────────────────────────────────
-- DetachX: Create core tables for unsubscribe & block tracking
-- Migration 001 (2024-06-01)
-- ──────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: unsub_history
-- Tracks user unsubscribe actions and their verification statuses.
-- Uses upsert on (user_email, domain) so repeated scans update rather than
-- duplicate rows.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.unsub_history (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_email           TEXT        NOT NULL,
  domain               TEXT        NOT NULL,
  from_addr            TEXT,
  email                TEXT,
  subject              TEXT        DEFAULT '',
  unsub_url            TEXT        DEFAULT '',
  action               TEXT        DEFAULT 'unsubscribed',
  verification_status  TEXT        DEFAULT 'user_unsubscribed'
                                   CHECK (verification_status IN (
                                     'user_unsubscribed',
                                     'unsubscribe_failed'
                                   )),
  needs_verification   BOOLEAN     DEFAULT false,
  still_receiving      BOOLEAN     DEFAULT false,
  action_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Enforce one row per (user, domain) — supports the code's upsert onConflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_unsub_history_user_domain
  ON public.unsub_history (user_email, domain);

-- Fast lookups by user
CREATE INDEX IF NOT EXISTS idx_unsub_history_user_email
  ON public.unsub_history (user_email);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: block_history
-- Tracks Gmail filter blocks created by the user.
-- Uses upsert on (user_email, domain) to prevent duplicate filter records.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.block_history (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_email    TEXT        NOT NULL,
  domain        TEXT        NOT NULL,
  from_addr     TEXT,
  email         TEXT,
  subject       TEXT        DEFAULT '',
  action        TEXT        DEFAULT 'blocked',
  filter_id     TEXT,
  filter_email  TEXT,
  action_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Enforce one row per (user, domain) — supports the code's upsert onConflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_block_history_user_domain
  ON public.block_history (user_email, domain);

-- Fast lookups by user
CREATE INDEX IF NOT EXISTS idx_block_history_user_email
  ON public.block_history (user_email);


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

-- unsub_history
ALTER TABLE public.unsub_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY unsub_history_select ON public.unsub_history
  FOR SELECT USING (user_email = auth.email());

CREATE POLICY unsub_history_insert ON public.unsub_history
  FOR INSERT WITH CHECK (user_email = auth.email());

CREATE POLICY unsub_history_update ON public.unsub_history
  FOR UPDATE USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY unsub_history_delete ON public.unsub_history
  FOR DELETE USING (user_email = auth.email());

-- block_history
ALTER TABLE public.block_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY block_history_select ON public.block_history
  FOR SELECT USING (user_email = auth.email());

CREATE POLICY block_history_insert ON public.block_history
  FOR INSERT WITH CHECK (user_email = auth.email());

CREATE POLICY block_history_update ON public.block_history
  FOR UPDATE USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY block_history_delete ON public.block_history
  FOR DELETE USING (user_email = auth.email());


-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER: auto-update updated_at on row modification
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unsub_history_updated_at ON public.unsub_history;

CREATE TRIGGER trg_unsub_history_updated_at
  BEFORE UPDATE ON public.unsub_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
