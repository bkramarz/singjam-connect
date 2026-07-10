-- Enable realtime for the songs catalog and its join tables, so a live
-- edit to a song (title, tonality, meter, composers, genres, etc.) reflects
-- immediately in any set list currently displaying it.
--
-- No replica identity changes needed:
-- - songs: the client only reads payload.new (always the full row on
--   UPDATE regardless of identity), and never subscribes to DELETE here
--   (a deleted song cascades to delete its set_songs rows, which already
--   broadcasts via the existing set_songs DELETE subscription).
-- - the six join tables all have composite primary keys that include
--   song_id (see 003_songs_schema_expansion.sql), so default replica
--   identity already includes song_id in DELETE's old record.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables
  ) then
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'songs'
    ) then
      alter publication supabase_realtime add table public.songs;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_composers'
    ) then
      alter publication supabase_realtime add table public.song_composers;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_lyricists'
    ) then
      alter publication supabase_realtime add table public.song_lyricists;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_cultures'
    ) then
      alter publication supabase_realtime add table public.song_cultures;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_genres'
    ) then
      alter publication supabase_realtime add table public.song_genres;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_themes'
    ) then
      alter publication supabase_realtime add table public.song_themes;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_recording_artists'
    ) then
      alter publication supabase_realtime add table public.song_recording_artists;
    end if;
  end if;
end $$;
