
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_billing_cycle text CHECK (pending_billing_cycle IN ('monthly','yearly')),
  ADD COLUMN IF NOT EXISTS pending_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.assert_not_banned(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _banned boolean;
BEGIN
  SELECT is_banned INTO _banned FROM public.profiles WHERE id = _user_id;
  IF COALESCE(_banned, false) THEN
    RAISE EXCEPTION 'Ce compte est suspendu. Contactez l''administration.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_admin_only_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    PERFORM public.assert_not_admin_only(NEW.owner_id);
    PERFORM public.assert_not_banned(NEW.owner_id);
  ELSIF TG_TABLE_NAME = 'company_members' THEN
    PERFORM public.assert_not_admin_only(NEW.user_id);
    PERFORM public.assert_not_banned(NEW.user_id);
  ELSIF TG_TABLE_NAME = 'reports' THEN
    PERFORM public.assert_not_admin_only(NEW.author_id);
    PERFORM public.assert_not_banned(NEW.author_id);
  ELSIF TG_TABLE_NAME = 'report_minutes' THEN
    PERFORM public.assert_not_admin_only(NEW.author_id);
    PERFORM public.assert_not_banned(NEW.author_id);
  END IF;
  RETURN NEW;
END;
$$;
