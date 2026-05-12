alter table public.songs
  add column if not exists spotify_url text;
