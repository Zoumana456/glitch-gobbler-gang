
-- Remove anon-accessible share policies. Public share access happens via server
-- functions using the admin client, which bypasses RLS and enforces both the
-- token match and the expiration check server-side. Keeping anon SELECT
-- policies exposed the share_token column and did not check expiry.

DROP POLICY IF EXISTS "Public can view shared reports" ON public.reports;
DROP POLICY IF EXISTS "Public can view sections of shared reports" ON public.report_sections;
DROP POLICY IF EXISTS "Public can view images of shared reports" ON public.report_images;
DROP POLICY IF EXISTS "Public can view bullets of shared reports" ON public.section_bullets;

-- Revoke anon table privileges granted for those policies (if any).
REVOKE SELECT ON public.reports FROM anon;
REVOKE SELECT ON public.report_sections FROM anon;
REVOKE SELECT ON public.report_images FROM anon;
REVOKE SELECT ON public.section_bullets FROM anon;
