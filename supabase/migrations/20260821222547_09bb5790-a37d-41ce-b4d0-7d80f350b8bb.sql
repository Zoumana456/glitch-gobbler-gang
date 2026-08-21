-- =========================================================
-- Module Messagerie unifiée
-- =========================================================

CREATE TABLE public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail','microsoft','yahoo','imap')),
  email text NOT NULL,
  display_name text,
  label text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disabled','error','reauth_required')),
  status_message text,
  is_primary boolean NOT NULL DEFAULT false,
  signature text,
  signature_mode text NOT NULL DEFAULT 'auto' CHECK (signature_mode IN ('auto','manual','none')),
  -- secrets (chiffrés AES-256-GCM côté serveur, jamais exposés au client)
  connection_key_ciphertext text,
  imap_password_ciphertext text,
  imap_host text,
  imap_port integer,
  imap_security text,
  smtp_host text,
  smtp_port integer,
  smtp_security text,
  imap_username text,
  gateway_account_id text,
  unread_count integer NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, email)
);

CREATE INDEX email_accounts_user_idx ON public.email_accounts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_accounts TO authenticated;
GRANT ALL ON public.email_accounts TO service_role;
-- Les colonnes de secrets ne doivent jamais partir vers le client
REVOKE SELECT ON public.email_accounts FROM authenticated;
GRANT SELECT (
  id, user_id, provider, email, display_name, label, status, status_message,
  is_primary, signature, signature_mode, imap_host, imap_port, imap_security,
  smtp_host, smtp_port, smtp_security, imap_username, unread_count,
  last_sync_at, created_at, updated_at
) ON public.email_accounts TO authenticated;

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_accounts_select_own" ON public.email_accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR app_private.is_platform_admin(auth.uid()));

CREATE POLICY "email_accounts_insert_own" ON public.email_accounts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_accounts_update_own" ON public.email_accounts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_accounts_delete_own" ON public.email_accounts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR app_private.is_platform_admin(auth.uid()));

CREATE TRIGGER email_accounts_set_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------

CREATE TABLE public.email_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  provider_folder_id text NOT NULL,
  unread_count integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_folder_id)
);

CREATE INDEX email_folders_account_idx ON public.email_folders(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_folders TO authenticated;
GRANT ALL ON public.email_folders TO service_role;
ALTER TABLE public.email_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_folders_all_own" ON public.email_folders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER email_folders_set_updated_at
  BEFORE UPDATE ON public.email_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------

CREATE TABLE public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_recipients text NOT NULL DEFAULT '',
  cc_recipients text NOT NULL DEFAULT '',
  bcc_recipients text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  in_reply_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_drafts_user_idx ON public.email_drafts(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT ALL ON public.email_drafts TO service_role;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_drafts_all_own" ON public.email_drafts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER email_drafts_set_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------

CREATE TABLE public.email_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_sync_logs_user_idx ON public.email_sync_logs(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.email_sync_logs TO authenticated;
GRANT ALL ON public.email_sync_logs TO service_role;
ALTER TABLE public.email_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_sync_logs_select_own" ON public.email_sync_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR app_private.is_platform_admin(auth.uid()));

CREATE POLICY "email_sync_logs_insert_own" ON public.email_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);