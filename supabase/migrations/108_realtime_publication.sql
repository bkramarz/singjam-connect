-- Add tables to the supabase_realtime publication so Postgres change events
-- are delivered to subscribers. Skipped automatically if the publication is
-- already FOR ALL TABLES (puballtables = true).
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables
  ) then
    alter publication supabase_realtime add table public.set_collaborators;
    alter publication supabase_realtime add table public.user_songs;
  end if;
end $$;
