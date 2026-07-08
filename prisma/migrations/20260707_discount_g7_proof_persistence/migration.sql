ALTER TABLE public.cevonne_discounts
  ADD COLUMN IF NOT EXISTS g7_proof_status text NOT NULL DEFAULT 'NOT_CHECKED',
  ADD COLUMN IF NOT EXISTS g7_proof_scope text,
  ADD COLUMN IF NOT EXISTS g7_verified_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS g7_needs_evidence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS g7_blocked_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS g7_last_checked_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS g7_last_summary text,
  ADD COLUMN IF NOT EXISTS g7_last_items jsonb;

UPDATE public.cevonne_discounts
SET
  g7_proof_status = 'NOT_CHECKED',
  g7_verified_count = 0,
  g7_needs_evidence_count = 0,
  g7_blocked_count = 0,
  g7_last_checked_at = NULL,
  g7_last_summary = NULL,
  g7_last_items = NULL
WHERE g7_proof_status = 'VERIFIED'
  AND g7_last_checked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_g7_last_checked_at
  ON public.cevonne_discounts (g7_last_checked_at);

CREATE INDEX IF NOT EXISTS idx_cevonne_discounts_g7_proof_status
  ON public.cevonne_discounts (g7_proof_status);
