ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS signature_image text,
  ADD COLUMN IF NOT EXISTS stamp_image text,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_role text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;