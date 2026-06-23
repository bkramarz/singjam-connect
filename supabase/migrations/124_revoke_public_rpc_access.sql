-- Fix 123: revoking from anon/authenticated is insufficient when PUBLIC still has EXECUTE.
-- Must revoke from PUBLIC (the role all users inherit), then re-grant to authenticated where needed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_google_avatar() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.search_users(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_users(text, uuid) TO authenticated;
