-- Note: Supabase Realtime doesn't support filtering DELETE events at all
-- (regardless of replica identity), so the client subscribes unfiltered to
-- set_songs deletes and matches by primary key. Full replica identity isn't
-- required for that, but is harmless to set here in case a future UPDATE/DELETE
-- handler needs old-row columns beyond the primary key.
alter table public.set_songs replica identity full;

-- sets is only filtered by id (its primary key), so the default replica
-- identity already carries what's needed — no identity change required.

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables
  ) then
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'set_songs'
    ) then
      alter publication supabase_realtime add table public.set_songs;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sets'
    ) then
      alter publication supabase_realtime add table public.sets;
    end if;
  end if;
end $$;
