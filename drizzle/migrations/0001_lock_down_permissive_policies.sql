DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.crm_companies;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.crm_contacts;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.crm_deals;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.inventory_items;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.events;

CREATE POLICY "Platform admins manage crm_companies" ON public.crm_companies FOR ALL TO authenticated
  USING (app_private.is_platform_admin(auth.uid())) WITH CHECK (app_private.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins manage crm_contacts" ON public.crm_contacts FOR ALL TO authenticated
  USING (app_private.is_platform_admin(auth.uid())) WITH CHECK (app_private.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins manage crm_deals" ON public.crm_deals FOR ALL TO authenticated
  USING (app_private.is_platform_admin(auth.uid())) WITH CHECK (app_private.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins manage inventory_items" ON public.inventory_items FOR ALL TO authenticated
  USING (app_private.is_platform_admin(auth.uid())) WITH CHECK (app_private.is_platform_admin(auth.uid()));
CREATE POLICY "Owners or admins manage inventory_movements" ON public.inventory_movements FOR ALL TO authenticated
  USING (created_by = auth.uid() OR app_private.is_platform_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR app_private.is_platform_admin(auth.uid()));
CREATE POLICY "Authors manage own events" ON public.events FOR ALL TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "ai_agents_read" ON public.ai_agents;
CREATE POLICY "ai_agents_read" ON public.ai_agents FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND is_enabled);

DROP POLICY IF EXISTS "company_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "company_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "company_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_documents_select" ON storage.objects;
CREATE POLICY "company_documents_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "company_documents_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-documents' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'company-documents' AND owner_id = auth.uid()::text);
CREATE POLICY "company_documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-documents' AND owner_id = auth.uid()::text);
CREATE POLICY "company_documents_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-documents' AND owner_id = auth.uid()::text);