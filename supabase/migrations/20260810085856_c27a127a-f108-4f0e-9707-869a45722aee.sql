CREATE TABLE public.company_modules (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, module_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_modules TO authenticated;
GRANT ALL ON public.company_modules TO service_role;
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_modules_select_members" ON public.company_modules
FOR SELECT TO authenticated
USING (
  company_id = app_private.get_user_company(auth.uid())
  OR app_private.is_platform_admin(auth.uid())
);

CREATE POLICY "company_modules_insert_owner" ON public.company_modules
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR app_private.is_platform_admin(auth.uid())
);

CREATE POLICY "company_modules_update_owner" ON public.company_modules
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR app_private.is_platform_admin(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR app_private.is_platform_admin(auth.uid())
);

CREATE POLICY "company_modules_delete_owner" ON public.company_modules
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR app_private.is_platform_admin(auth.uid())
);

CREATE TRIGGER company_modules_set_updated_at
BEFORE UPDATE ON public.company_modules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date date,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_company_idx ON public.tasks (company_id, status);
CREATE INDEX tasks_assignee_idx ON public.tasks (assignee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_company" ON public.tasks
FOR SELECT TO authenticated
USING (
  company_id = app_private.get_user_company(auth.uid())
  OR app_private.is_platform_admin(auth.uid())
);

CREATE POLICY "tasks_insert_own_company" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND company_id = app_private.get_user_company(auth.uid())
);

CREATE POLICY "tasks_update_involved" ON public.tasks
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR (assignee_id IS NOT NULL AND app_private.is_manager_of(auth.uid(), assignee_id))
)
WITH CHECK (
  company_id = app_private.get_user_company(auth.uid())
);

CREATE POLICY "tasks_delete_owner_or_manager" ON public.tasks
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR (assignee_id IS NOT NULL AND app_private.is_manager_of(auth.uid(), assignee_id))
);

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_comments_task_idx ON public.task_comments (task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select_visible" ON public.task_comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND (t.company_id = app_private.get_user_company(auth.uid())
           OR app_private.is_platform_admin(auth.uid()))
  )
);

CREATE POLICY "task_comments_insert_own" ON public.task_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id
      AND t.company_id = app_private.get_user_company(auth.uid())
  )
);

CREATE POLICY "task_comments_delete_own" ON public.task_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid());