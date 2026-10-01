CREATE OR REPLACE FUNCTION app_private.can_access_project(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project AND (
    p.owner_id = auth.uid() OR (p.company_id IS NOT NULL AND app_private.is_company_member(auth.uid(), p.company_id))))
$$;
GRANT EXECUTE ON FUNCTION app_private.can_access_project(uuid) TO authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['project_milestones','project_members','project_budget_lines','project_files'] LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', t || '_access', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (app_private.can_access_project(project_id)) WITH CHECK (app_private.can_access_project(project_id))', t || '_access', t);
  END LOOP;
END $$;
DROP POLICY project_files_obj_select ON storage.objects;
DROP POLICY project_files_obj_insert ON storage.objects;
DROP POLICY project_files_obj_delete ON storage.objects;
CREATE POLICY project_files_obj_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND app_private.can_access_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY project_files_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND app_private.can_access_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY project_files_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND app_private.can_access_project(((storage.foldername(name))[1])::uuid));
DROP FUNCTION public.can_access_project(uuid);