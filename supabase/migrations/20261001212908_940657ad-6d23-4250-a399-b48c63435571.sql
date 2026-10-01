CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  code text NOT NULL,
  title text NOT NULL,
  client text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'draft',
  health text NOT NULL DEFAULT 'on_track',
  manager_name text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  context text NOT NULL DEFAULT '',
  objectives text NOT NULL DEFAULT '',
  deliverables text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  budget numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_access_project(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project AND (
      p.owner_id = auth.uid()
      OR (p.company_id IS NOT NULL AND app_private.is_company_member(auth.uid(), p.company_id))
    )
  )
$$;

CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (company_id IS NOT NULL AND app_private.is_company_member(auth.uid(), company_id)));
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND (company_id IS NULL OR app_private.is_company_member(auth.uid(), company_id)));
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR (company_id IS NOT NULL AND app_private.is_company_member(auth.uid(), company_id)));
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id)));

CREATE TABLE public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  responsible text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  planned numeric NOT NULL DEFAULT 0,
  spent numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['project_milestones','project_members','project_budget_lines','project_files'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_access_project(project_id)) WITH CHECK (public.can_access_project(project_id))', t || '_access', t);
  END LOOP;
END $$;

CREATE POLICY project_files_obj_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND public.can_access_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY project_files_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.can_access_project(((storage.foldername(name))[1])::uuid));
CREATE POLICY project_files_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND public.can_access_project(((storage.foldername(name))[1])::uuid));