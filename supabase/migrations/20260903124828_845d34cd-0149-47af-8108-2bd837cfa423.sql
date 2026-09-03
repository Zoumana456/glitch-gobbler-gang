ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'report',
  ADD COLUMN IF NOT EXISTS doc_number text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS period_label text,
  ADD COLUMN IF NOT EXISTS counterparty text;

CREATE INDEX IF NOT EXISTS reports_doc_type_idx ON public.reports (doc_type);

CREATE TABLE IF NOT EXISTS public.report_budget_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  planned_amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_budget_lines_report_idx ON public.report_budget_lines (report_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_budget_lines TO authenticated;
GRANT ALL ON public.report_budget_lines TO service_role;

ALTER TABLE public.report_budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget lines select own" ON public.report_budget_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_budget_lines.report_id AND r.author_id = auth.uid()));

CREATE POLICY "budget lines select shared" ON public.report_budget_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_budget_lines.report_id AND s.shared_with = auth.uid()));

CREATE POLICY "DG reads employee budget lines" ON public.report_budget_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_budget_lines.report_id AND app_private.is_dg_of_user(auth.uid(), r.author_id)));

CREATE POLICY "budget lines write own" ON public.report_budget_lines FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_budget_lines.report_id AND r.author_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_budget_lines.report_id AND r.author_id = auth.uid()));

CREATE POLICY "budget lines write shared edit" ON public.report_budget_lines FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_budget_lines.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'))
WITH CHECK (EXISTS (SELECT 1 FROM public.report_shares s WHERE s.report_id = report_budget_lines.report_id AND s.shared_with = auth.uid() AND s.permission = 'edit'));