ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS oauth_access_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token_ciphertext text,
  ADD COLUMN IF NOT EXISTS oauth_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS oauth_scope text,
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'password';

UPDATE public.email_accounts SET auth_type = 'password' WHERE auth_type IS NULL;