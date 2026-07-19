
REVOKE ALL ON FUNCTION public.assert_not_banned(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_not_banned(uuid) TO service_role;
