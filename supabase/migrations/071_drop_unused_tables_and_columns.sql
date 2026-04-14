-- Drop unused join tables first (foreign key dependencies)
drop table if exists public.song_pack_songs;
drop table if exists public.song_packs;
drop table if exists public.song_resources;
drop table if exists public.song_traditions;
drop table if exists public.traditions;

-- Drop unused columns from songs
alter table public.songs
  drop column if exists seed_key,
  drop column if exists difficulty,
  drop column if exists energy,
  drop column if exists lyrics,
  drop column if exists popularity,
  drop column if exists singjam_play_count;
