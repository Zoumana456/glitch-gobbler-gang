ALTER TABLE public.leave_requests ALTER COLUMN leave_type SET DEFAULT 'paid';

DROP POLICY IF EXISTS "temporary_dev_insert" ON public.email_accounts;
DROP POLICY IF EXISTS "temporary_dev_update" ON public.email_accounts;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;