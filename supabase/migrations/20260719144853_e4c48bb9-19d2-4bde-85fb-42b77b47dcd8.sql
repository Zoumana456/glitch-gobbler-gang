CREATE TABLE public.company_name_risk_cache (
  slug text PRIMARY KEY,
  original_name text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('none','low','medium','high')),
  matched_entity text,
  evidence text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_name_risk_cache TO authenticated;
GRANT ALL ON public.company_name_risk_cache TO service_role;

ALTER TABLE public.company_name_risk_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read risk cache"
  ON public.company_name_risk_cache
  FOR SELECT
  TO authenticated
  USING (true);