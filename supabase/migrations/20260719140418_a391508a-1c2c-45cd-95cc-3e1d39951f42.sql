-- Restrict reserved_company_names direct reads to platform admins only.
DROP POLICY IF EXISTS "authenticated read reserved names" ON public.reserved_company_names;
CREATE POLICY "platform admins read reserved names"
  ON public.reserved_company_names
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));

-- Tighten report_shares insert: actor must own the report (author). Remove DG-bypass.
DROP POLICY IF EXISTS "shares insert by allowed" ON public.report_shares;
CREATE POLICY "shares insert by author"
  ON public.report_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by = auth.uid()
    AND shared_with <> auth.uid()
    AND app_private.is_report_author(auth.uid(), report_id)
  );
