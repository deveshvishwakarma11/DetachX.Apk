-- ──────────────────────────────────────────────────────────────────────────────
-- DetachX: Create footprint discovery tables
-- Migration 002 (2024-06-01)
--
-- Adds three tables for the Digital Footprint Discovery Engine:
--   discovered_accounts  — accounts/services found via Gmail evidence
--   evidence_messages    — individual Gmail messages supporting each account
--   service_deletion_info — metadata for future account deletion assistant
-- ──────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: discovered_accounts
-- Stores services/accounts detected from Gmail evidence.
-- One row per (user_email, domain) — updated on subsequent scans.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.discovered_accounts (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_email        TEXT        NOT NULL,
  service_name      TEXT        NOT NULL,
  domain            TEXT        NOT NULL,
  account_email     TEXT,
  category          TEXT        DEFAULT 'Unknown',
  confidence_score  SMALLINT   DEFAULT 0,
  risk_score        SMALLINT   DEFAULT 50,
  risk_level        TEXT        DEFAULT 'medium'
                                CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_factors      JSONB      DEFAULT '[]'::jsonb,
  status            TEXT        DEFAULT 'active'
                                CHECK (status IN ('active', 'inactive', 'dormant')),
  first_seen        TIMESTAMPTZ,
  last_seen         TIMESTAMPTZ,
  evidence_count    INTEGER     DEFAULT 0,
  evidence_types    TEXT[]      DEFAULT '{}',
  scanned_at        TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  -- One account record per (user, domain) — upsert-safe
  CONSTRAINT uq_discovered_accounts_user_domain UNIQUE (user_email, domain)
);

-- Fast lookups by user
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_user_email
  ON public.discovered_accounts (user_email);

-- Fast lookups by category + user
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_category
  ON public.discovered_accounts (user_email, category);

-- Fast lookups by risk level + user
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_risk
  ON public.discovered_accounts (user_email, risk_level);

-- Fast lookups by status + user (for forgotten accounts)
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_status
  ON public.discovered_accounts (user_email, status);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: evidence_messages
-- Each row links a Gmail message to a discovered account.
-- Provides audit trail showing exactly which emails support each detection.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.evidence_messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id      BIGINT       NOT NULL REFERENCES public.discovered_accounts(id)
                                ON DELETE CASCADE,
  message_id      TEXT         NOT NULL,
  evidence_type   TEXT         NOT NULL
                                CHECK (evidence_type IN (
                                  'account_creation',
                                  'verification',
                                  'security',
                                  'purchase',
                                  'weak'
                                )),
  subject         TEXT         DEFAULT '',
  from_addr       TEXT         DEFAULT '',
  snippet         TEXT         DEFAULT '',
  received_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT now()
);

-- Fast lookups by account
CREATE INDEX IF NOT EXISTS idx_evidence_messages_account
  ON public.evidence_messages (account_id);

-- Prevent duplicate evidence (same message for same account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_messages_unique
  ON public.evidence_messages (account_id, message_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE: service_deletion_info
-- Curated metadata for future account deletion assistant.
-- Pre-populated with known services' privacy and deletion URLs.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.service_deletion_info (
  domain              TEXT PRIMARY KEY,
  service_name        TEXT NOT NULL,
  homepage            TEXT,
  privacy_policy_url  TEXT,
  deletion_url        TEXT,
  support_url         TEXT,
  category            TEXT DEFAULT 'Unknown'
);

-- Allow reading for all authenticated users (no PII in this table)
ALTER TABLE public.service_deletion_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_deletion_info_select ON public.service_deletion_info
  FOR SELECT USING (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY — discovered_accounts
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.discovered_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own accounts
CREATE POLICY discovered_accounts_select ON public.discovered_accounts
  FOR SELECT USING (user_email = auth.email());

-- Users can insert their own accounts
CREATE POLICY discovered_accounts_insert ON public.discovered_accounts
  FOR INSERT WITH CHECK (user_email = auth.email());

-- Users can update their own accounts
CREATE POLICY discovered_accounts_update ON public.discovered_accounts
  FOR UPDATE USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- Users can delete their own accounts
CREATE POLICY discovered_accounts_delete ON public.discovered_accounts
  FOR DELETE USING (user_email = auth.email());


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY — evidence_messages
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.evidence_messages ENABLE ROW LEVEL SECURITY;

-- Evidence visibility is controlled via the parent account
CREATE POLICY evidence_messages_select ON public.evidence_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.discovered_accounts da
      WHERE da.id = account_id AND da.user_email = auth.email()
    )
  );

CREATE POLICY evidence_messages_insert ON public.evidence_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.discovered_accounts da
      WHERE da.id = account_id AND da.user_email = auth.email()
    )
  );

CREATE POLICY evidence_messages_delete ON public.evidence_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.discovered_accounts da
      WHERE da.id = account_id AND da.user_email = auth.email()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at on discovered_accounts
-- ══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_discovered_accounts_updated_at
  ON public.discovered_accounts;

CREATE TRIGGER trg_discovered_accounts_updated_at
  BEFORE UPDATE ON public.discovered_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
