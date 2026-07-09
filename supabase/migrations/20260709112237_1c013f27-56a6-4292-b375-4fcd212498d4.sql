
-- 1) Restrict base profiles SELECT to own row (hides email of others)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Public-safe view exposing only non-sensitive fields for team display
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, full_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;
