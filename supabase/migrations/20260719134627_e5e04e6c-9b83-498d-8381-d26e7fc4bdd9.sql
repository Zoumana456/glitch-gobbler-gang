
-- 1. Add admin_only flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_only BOOLEAN NOT NULL DEFAULT false;

-- 2. Guard function: raises if user is admin_only
CREATE OR REPLACE FUNCTION public.assert_not_admin_only(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin_only boolean;
BEGIN
  SELECT admin_only INTO _is_admin_only FROM public.profiles WHERE id = _user_id;
  IF COALESCE(_is_admin_only, false) THEN
    RAISE EXCEPTION 'Ce compte est réservé à l''administration de la plateforme et ne peut pas créer d''entreprise, de rapport ou de PV.';
  END IF;
END;
$$;

-- 3. Trigger: block admin_only users from owning companies / members / reports / minutes
CREATE OR REPLACE FUNCTION public.block_admin_only_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    PERFORM public.assert_not_admin_only(NEW.owner_id);
  ELSIF TG_TABLE_NAME = 'company_members' THEN
    PERFORM public.assert_not_admin_only(NEW.user_id);
  ELSIF TG_TABLE_NAME = 'reports' THEN
    PERFORM public.assert_not_admin_only(NEW.author_id);
  ELSIF TG_TABLE_NAME = 'report_minutes' THEN
    PERFORM public.assert_not_admin_only(NEW.author_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_admin_only_companies ON public.companies;
CREATE TRIGGER block_admin_only_companies
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_only_writes();

DROP TRIGGER IF EXISTS block_admin_only_members ON public.company_members;
CREATE TRIGGER block_admin_only_members
  BEFORE INSERT ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_only_writes();

DROP TRIGGER IF EXISTS block_admin_only_reports ON public.reports;
CREATE TRIGGER block_admin_only_reports
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_only_writes();

DROP TRIGGER IF EXISTS block_admin_only_minutes ON public.report_minutes;
CREATE TRIGGER block_admin_only_minutes
  BEFORE INSERT ON public.report_minutes
  FOR EACH ROW EXECUTE FUNCTION public.block_admin_only_writes();
