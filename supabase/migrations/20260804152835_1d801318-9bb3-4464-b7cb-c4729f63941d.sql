CREATE OR REPLACE FUNCTION public.protect_company_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_trusted boolean;
BEGIN
  -- service_role (server-side trusted logic) and platform admins may change billing fields
  _is_trusted := (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
    OR current_user = 'service_role'
    OR auth.uid() IS NULL
    OR app_private.is_platform_admin(auth.uid())
  );

  IF _is_trusted THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
     OR NEW.seat_limit IS DISTINCT FROM OLD.seat_limit
     OR NEW.custom_seat_price_cents IS DISTINCT FROM OLD.custom_seat_price_cents
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.pending_plan_id IS DISTINCT FROM OLD.pending_plan_id
     OR NEW.pending_billing_cycle IS DISTINCT FROM OLD.pending_billing_cycle
     OR NEW.pending_requested_at IS DISTINCT FROM OLD.pending_requested_at
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
  THEN
    RAISE EXCEPTION 'Les informations de facturation et d''abonnement ne peuvent pas être modifiées directement.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_billing_fields ON public.companies;
CREATE TRIGGER trg_protect_company_billing_fields
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.protect_company_billing_fields();