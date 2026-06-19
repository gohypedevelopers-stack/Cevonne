CREATE TABLE IF NOT EXISTS public.cevonne_g12_trend_fetch_runs (
  fetch_run_id text PRIMARY KEY,
  status text NOT NULL,
  raw_count integer NOT NULL DEFAULT 0,
  clean_count integer NOT NULL DEFAULT 0,
  stored_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  branch_key text,
  query text NOT NULL DEFAULT '',
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_comments_limit integer NOT NULL DEFAULT 0,
  platform_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_fetch_runs_completed_at
  ON public.cevonne_g12_trend_fetch_runs (completed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_fetch_runs_branch_key
  ON public.cevonne_g12_trend_fetch_runs (branch_key);

CREATE TABLE IF NOT EXISTS public.cevonne_g12_trend_insights (
  id text PRIMARY KEY,
  fetch_run_id text,
  branch_key text,
  branch_name text NOT NULL DEFAULT 'General',
  platform text NOT NULL DEFAULT 'UNKNOWN',
  title text NOT NULL,
  summary text NOT NULL,
  source_label text,
  created_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_insights_fetch_run_id
  ON public.cevonne_g12_trend_insights (fetch_run_id);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_insights_branch_key
  ON public.cevonne_g12_trend_insights (branch_key);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_insights_created_at
  ON public.cevonne_g12_trend_insights (created_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.cevonne_g12_trend_branch_status (
  branch_key text PRIMARY KEY,
  name text NOT NULL,
  frequency text NOT NULL,
  status text NOT NULL DEFAULT 'Testing',
  last_run_status text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  insight_count integer NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  requires_access boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_branch_status_sort_order
  ON public.cevonne_g12_trend_branch_status (sort_order);

CREATE TABLE IF NOT EXISTS public.cevonne_g12_trend_actions (
  action_key text PRIMARY KEY,
  manual_fetch_status text,
  manual_fetch_run_id text,
  manual_fetch_message text,
  approval_required boolean NOT NULL DEFAULT true,
  approval_requirement_message text NOT NULL DEFAULT '',
  google_search_demand_status text NOT NULL DEFAULT 'Needs Access',
  google_search_demand_message text NOT NULL DEFAULT '',
  google_search_allowed_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  apify_usage jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  compliance_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cevonne_g12_trend_actions_updated_at
  ON public.cevonne_g12_trend_actions (updated_at DESC NULLS LAST);
