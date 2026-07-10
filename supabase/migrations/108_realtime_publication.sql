-- Add tables to the supabase_realtime publication so Postgres change events
-- are delivered to subscribers. Skip publications that already cover all
-- tables, and check individual membership so this remains safe when a table
-- was enabled through the dashboard before migrations run.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'set_collaborators'
    ) then
      alter publication supabase_realtime add table public.set_collaborators;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_songs'
    ) then
      alter publication supabase_realtime add table public.user_songs;
    end if;
  end if;
end $$;
