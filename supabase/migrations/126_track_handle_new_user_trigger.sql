-- Backfills a migration for handle_new_user()/on_auth_user_created, which
-- already existed in the live database (added directly via the SQL editor,
-- not through a migration file) but wasn't tracked anywhere in the repo.
-- This inserts a bare profiles row on every new auth.users signup — it's why
-- app/auth/callback/route.ts must treat "profile exists but has no username"
-- as the new-user case, not "no profile row at all".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  insert into public.profiles (id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (id) do nothing;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
