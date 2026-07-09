
ALTER VIEW public.profiles_public SET (security_invoker = true);
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
