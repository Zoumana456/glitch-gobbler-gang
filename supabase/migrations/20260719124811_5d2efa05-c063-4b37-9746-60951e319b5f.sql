
ALTER TABLE public.company_verification_requests
  ADD COLUMN IF NOT EXISTS identity_document_path text,
  ADD COLUMN IF NOT EXISTS identity_document_type text,
  ADD COLUMN IF NOT EXISTS selfie_path text,
  ADD COLUMN IF NOT EXISTS full_legal_name text,
  ADD COLUMN IF NOT EXISTS ai_check_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_check_report jsonb;
