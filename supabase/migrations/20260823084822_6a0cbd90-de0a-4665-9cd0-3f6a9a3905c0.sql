-- Types de congé (company_id NULL = type standard disponible pour tous)
CREATE TABLE public.leave_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  requires_proof boolean NOT NULL DEFAULT false,
  default_days numeric(5,1) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX leave_types_global_code_idx ON public.leave_types (code) WHERE company_id IS NULL;
CREATE UNIQUE INDEX leave_types_company_code_idx ON public.leave_types (company_id, code) WHERE company_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_types_select" ON public.leave_types
FOR SELECT TO authenticated
USING (company_id IS NULL OR company_id = app_private.get_user_company(auth.uid()));

CREATE POLICY "leave_types_insert_owner" ON public.leave_types
FOR INSERT TO authenticated
WITH CHECK (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id));

CREATE POLICY "leave_types_update_owner" ON public.leave_types
FOR UPDATE TO authenticated
USING (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id))
WITH CHECK (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id));

CREATE POLICY "leave_types_delete_owner" ON public.leave_types
FOR DELETE TO authenticated
USING (company_id IS NOT NULL AND app_private.is_company_owner(auth.uid(), company_id));

CREATE TRIGGER leave_types_set_updated_at
BEFORE UPDATE ON public.leave_types
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.leave_types (company_id, code, name, is_paid, requires_proof, default_days, sort_order) VALUES
  (NULL, 'paid',   'Congé payé',       true,  false, 25, 1),
  (NULL, 'sick',   'Congé maladie',    true,  true,  0,  2),
  (NULL, 'unpaid', 'Congé sans solde', false, false, 0,  3),
  (NULL, 'remote', 'Télétravail',      true,  false, 0,  4),
  (NULL, 'other',  'Autre absence',    true,  false, 0,  5);

-- Demandes de congé
CREATE TABLE public.leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_start boolean NOT NULL DEFAULT false,
  half_end boolean NOT NULL DEFAULT false,
  days_count numeric(5,1) NOT NULL DEFAULT 1,
  reason text,
  proof_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','cancelled')),
  current_approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_dates CHECK (end_date >= start_date)
);
CREATE INDEX leave_requests_company_idx ON public.leave_requests (company_id, start_date);
CREATE INDEX leave_requests_user_idx ON public.leave_requests (user_id, status);
CREATE INDEX leave_requests_approver_idx ON public.leave_requests (current_approver_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests_select_company" ON public.leave_requests
FOR SELECT TO authenticated
USING (
  company_id = app_private.get_user_company(auth.uid())
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

CREATE TRIGGER leave_requests_set_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Décisions
CREATE TABLE public.leave_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leave_approvals_request_idx ON public.leave_approvals (request_id, decided_at);

GRANT SELECT, INSERT ON public.leave_approvals TO authenticated;
GRANT ALL ON public.leave_approvals TO service_role;
ALTER TABLE public.leave_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_approvals_select" ON public.leave_approvals
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.id = request_id
      AND (r.company_id = app_private.get_user_company(auth.uid())
           OR app_private.is_platform_admin(auth.uid()))
  )
);

CREATE POLICY "leave_approvals_insert_approver" ON public.leave_approvals
FOR INSERT TO authenticated
WITH CHECK (
  approver_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.leave_requests r
    WHERE r.id = request_id
      AND (r.current_approver_id = auth.uid()
           OR app_private.is_manager_of(auth.uid(), r.user_id)
           OR app_private.is_company_owner(auth.uid(), r.company_id))
  )
);

-- Soldes
CREATE TABLE public.leave_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  allocated_days numeric(5,1) NOT NULL DEFAULT 0,
  used_days numeric(5,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type_id, year)
);
CREATE INDEX leave_balances_company_idx ON public.leave_balances (company_id, year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_balances_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR app_private.is_manager_of(auth.uid(), user_id)
  OR app_private.is_company_owner(auth.uid(), company_id)
  OR app_private.is_platform_admin(auth.uid())
);

CREATE POLICY "leave_balances_insert_owner" ON public.leave_balances
FOR INSERT TO authenticated
WITH CHECK (app_private.is_company_owner(auth.uid(), company_id));

CREATE POLICY "leave_balances_update_owner" ON public.leave_balances
FOR UPDATE TO authenticated
USING (app_private.is_company_owner(auth.uid(), company_id))
WITH CHECK (app_private.is_company_owner(auth.uid(), company_id));

CREATE POLICY "leave_balances_delete_owner" ON public.leave_balances
FOR DELETE TO authenticated
USING (app_private.is_company_owner(auth.uid(), company_id));

CREATE TRIGGER leave_balances_set_updated_at
BEFORE UPDATE ON public.leave_balances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Règles d'accès aux justificatifs (bucket privé leave-proofs)
CREATE POLICY "leave_proofs_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leave-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "leave_proofs_select_own_or_manager" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'leave-proofs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR app_private.is_manager_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR app_private.is_company_owner(auth.uid(), app_private.get_user_company(auth.uid()))
  )
);

CREATE POLICY "leave_proofs_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'leave-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
