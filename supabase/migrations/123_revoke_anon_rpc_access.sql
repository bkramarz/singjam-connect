-- Revoke direct REST execution from anon/authenticated for trigger-only functions.
-- Trigger behavior is unaffected by execute grants — triggers always run as the
-- function owner (SECURITY DEFINER). This just closes the /rpc/ endpoint.

-- handle_new_user was created outside migrations; guard so fresh envs don't fail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_google_avatar() FROM anon, authenticated;

-- search_users is called server-side only (authenticated session).
-- The 109 migration granted authenticated explicitly but left the implicit
-- PUBLIC grant in place, so anon could still reach it via /rpc/.
REVOKE EXECUTE ON FUNCTION public.search_users(text, uuid) FROM anon;
