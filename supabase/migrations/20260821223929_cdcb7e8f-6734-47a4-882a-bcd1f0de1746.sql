-- Scheduled messages
CREATE TABLE public.email_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_recipients text NOT NULL DEFAULT '',
  cc_recipients text NOT NULL DEFAULT '',
  bcc_recipients text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_reply_to text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_scheduled_messages TO authenticated;
GRANT ALL ON public.email_scheduled_messages TO service_role;
ALTER TABLE public.email_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own scheduled messages"
ON public.email_scheduled_messages FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_email_scheduled_due ON public.email_scheduled_messages (status, scheduled_at);
CREATE INDEX idx_email_scheduled_user ON public.email_scheduled_messages (user_id, scheduled_at DESC);

CREATE TRIGGER email_scheduled_messages_set_updated_at
BEFORE UPDATE ON public.email_scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'personal',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or company templates"
ON public.email_templates FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR (
    scope = 'company'
    AND company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = email_templates.company_id AND cm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "insert own templates"
ON public.email_templates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own templates"
ON public.email_templates FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own templates"
ON public.email_templates FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER email_templates_set_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signatures
CREATE TABLE public.email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_signatures TO authenticated;
GRANT ALL ON public.email_signatures TO service_role;
ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own signatures"
ON public.email_signatures FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_email_signatures_account ON public.email_signatures (account_id);

CREATE TRIGGER email_signatures_set_updated_at
BEFORE UPDATE ON public.email_signatures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();