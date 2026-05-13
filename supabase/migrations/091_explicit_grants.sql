-- Supabase is removing auto-grants on public schema tables from May 30 2026 (new projects)
-- and October 30 2026 (existing projects). This migration backfills explicit grants for all
-- existing tables so PostgREST / supabase-js can continue to reach them.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare
  t text;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
