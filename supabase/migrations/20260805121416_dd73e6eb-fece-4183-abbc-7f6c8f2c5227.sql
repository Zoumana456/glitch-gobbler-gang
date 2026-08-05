DROP POLICY IF EXISTS "Authenticated can read risk cache" ON public.company_name_risk_cache;

CREATE POLICY "platform admins read risk cache"
ON public.company_name_risk_cache
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));