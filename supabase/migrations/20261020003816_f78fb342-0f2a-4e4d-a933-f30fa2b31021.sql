REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;