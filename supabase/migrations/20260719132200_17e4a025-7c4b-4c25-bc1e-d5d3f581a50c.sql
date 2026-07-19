
-- 1) subscription_plans
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  yearly_price_cents INTEGER NOT NULL DEFAULT 0,
  seat_limit INTEGER NOT NULL DEFAULT 3,
  price_per_extra_seat_cents INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  stripe_product_id TEXT,
  stripe_price_monthly_id TEXT,
  stripe_price_yearly_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone auth can read active plans"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR app_private.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage plans"
  ON public.subscription_plans FOR ALL
  TO authenticated
  USING (app_private.is_platform_admin(auth.uid()))
  WITH CHECK (app_private.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) companies: billing columns
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  ADD COLUMN IF NOT EXISTS custom_seat_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- 3) company_invoices
CREATE TABLE public.company_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void','overdue')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  stripe_invoice_id TEXT,
  pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invoices TO authenticated;
GRANT ALL ON public.company_invoices TO service_role;
ALTER TABLE public.company_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own invoices"
  ON public.company_invoices FOR SELECT
  TO authenticated
  USING (
    app_private.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  );

CREATE POLICY "Admins manage invoices"
  ON public.company_invoices FOR ALL
  TO authenticated
  USING (app_private.is_platform_admin(auth.uid()))
  WITH CHECK (app_private.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.company_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) admin_audit_log
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (app_private.is_platform_admin(auth.uid()));

CREATE POLICY "Admins insert audit"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_platform_admin(auth.uid()));

CREATE INDEX idx_audit_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON public.admin_audit_log(action);

-- 5) Seed default plans
INSERT INTO public.subscription_plans (code, name, description, monthly_price_cents, yearly_price_cents, seat_limit, price_per_extra_seat_cents, features, sort_order)
VALUES
  ('free', 'Free', 'Pour découvrir DailyBrief', 0, 0, 3, 0,
    '["3 sièges", "Rapports illimités", "Support communautaire"]'::jsonb, 1),
  ('pro', 'Pro', 'Pour les équipes qui se développent', 2900, 29000, 10, 500,
    '["10 sièges inclus", "Assistant IA illimité", "Partages sécurisés", "Support prioritaire"]'::jsonb, 2),
  ('business', 'Business', 'Pour les organisations', 9900, 99000, 50, 300,
    '["50 sièges inclus", "KYC prioritaire", "Journal d''audit", "Support dédié"]'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;
