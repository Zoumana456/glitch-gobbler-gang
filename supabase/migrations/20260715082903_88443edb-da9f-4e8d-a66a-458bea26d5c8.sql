
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ NULL;

CREATE TABLE public.share_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  actor_id UUID NULL,
  action TEXT NOT NULL CHECK (action IN ('created','copied','revoked','regenerated','viewed','exported')),
  ip TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX share_audit_log_report_id_created_at_idx
  ON public.share_audit_log (report_id, created_at DESC);

GRANT SELECT ON public.share_audit_log TO authenticated;
GRANT ALL ON public.share_audit_log TO service_role;

ALTER TABLE public.share_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Report authors can read audit log"
  ON public.share_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = share_audit_log.report_id
        AND r.author_id = auth.uid()
    )
  );
