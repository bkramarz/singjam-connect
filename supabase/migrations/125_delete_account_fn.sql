-- Lets an authenticated user delete their own account.
-- SECURITY DEFINER runs with postgres-level privileges so it can
-- write to auth.users, which is not accessible to the authenticated role directly.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
