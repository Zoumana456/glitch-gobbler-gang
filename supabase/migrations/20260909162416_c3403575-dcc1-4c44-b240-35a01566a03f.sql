-- 1. Colonnes manquantes sur leave_requests
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type_id uuid REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS half_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS half_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS days_count numeric(5,1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS proof_path text,
  ADD COLUMN IF NOT EXISTS current_approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

-- 2. Reprise des données existantes
UPDATE public.leave_requests SET user_id = employee_id WHERE user_id IS NULL;
UPDATE public.leave_requests r
   SET company_id = app_private.get_user_company(r.user_id)
 WHERE r.company_id IS NULL AND r.user_id IS NOT NULL;
UPDATE public.leave_requests r
   SET type_id = (SELECT t.id FROM public.leave_types t
                   WHERE t.company_id IS NULL
                   ORDER BY (t.code = 'paid') DESC, t.sort_order
                   LIMIT 1)
 WHERE r.type_id IS NULL;

-- 3. Compatibilité des anciennes colonnes obligatoires
CREATE OR REPLACE FUNCTION public.leave_requests_fill_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN NEW.employee_id := NEW.user_id; END IF;
  IF NEW.user_id IS NULL THEN NEW.user_id := NEW.employee_id; END IF;
  IF NEW.leave_type IS NULL THEN
    NEW.leave_type := COALESCE(
      (SELECT t.code FROM public.leave_types t WHERE t.id = NEW.type_id),
      'paid'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_requests_fill_legacy_trg ON public.leave_requests;
CREATE TRIGGER leave_requests_fill_legacy_trg
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.leave_requests_fill_legacy();

DROP TRIGGER IF EXISTS leave_requests_set_updated_at ON public.leave_requests;
CREATE TRIGGER leave_requests_set_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS leave_requests_company_idx ON public.leave_requests (company_id, start_date);
CREATE INDEX IF NOT EXISTS leave_requests_user_idx ON public.leave_requests (user_id, status);
CREATE INDEX IF NOT EXISTS leave_requests_approver_idx ON public.leave_requests (current_approver_id, status);

-- 4. Politiques d'accès alignées sur le module
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can insert their own leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_select_company" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert_own" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_own_or_approver" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete_own_draft" ON public.leave_requests;

CREATE POLICY "leave_requests_select_company" ON public.leave_requests
FOR SELECT TO authenticated
USING (
  company_id = app_private.get_user_company(auth.uid())
  OR user_id = auth.uid()
  OR app_private.is_platform_admin(auth.uid())
);

CREATE POLICY "leave_requests_insert_own" ON public.leave_requests
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND company_id = app_private.get_user_company(auth.uid())
);

CREATE POLICY "leave_requests_update_own_or_approver" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR current_approver_id = auth.uid()
  OR app_private.is_manager_of(auth.uid(), user_id)
  OR app_private.is_company_owner(auth.uid(), company_id)
)
WITH CHECK (company_id = app_private.get_user_company(auth.uid()));

CREATE POLICY "leave_requests_delete_own_draft" ON public.leave_requests
FOR DELETE TO authenticated
USING (user_id = auth.uid() AND status IN ('draft','cancelled','rejected'));

-- 5. Journal des décisions
GRANT SELECT, INSERT ON public.leave_approvals TO authenticated;
GRANT ALL ON public.leave_approvals TO service_role;
ALTER TABLE public.leave_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_approvals_select" ON public.leave_approvals;
DROP POLICY IF EXISTS "leave_approvals_insert_approver" ON public.leave_approvals;

CREATE POLICY "leave_approvals_select" ON public.leave_approvals
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.id = request_id
      AND (r.company_id = app_private.get_user_company(auth.uid())
           OR r.user_id = auth.uid()
           OR app_private.is_platform_admin(auth.uid()))
  )
);

CREATE POLICY "leave_approvals_insert_approver" ON public.leave_approvals
FOR INSERT TO authenticated
WITH CHECK (approver_id = auth.uid());