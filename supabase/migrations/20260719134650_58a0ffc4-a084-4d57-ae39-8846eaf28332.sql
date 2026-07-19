
REVOKE EXECUTE ON FUNCTION public.assert_not_admin_only(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_admin_only_writes() FROM PUBLIC, anon, authenticated;
