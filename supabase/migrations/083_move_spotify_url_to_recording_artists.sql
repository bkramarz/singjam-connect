alter table public.song_recording_artists
  add column if not exists spotify_url text;

-- Migrate any existing songs.spotify_url to the primary recording artist row
update public.song_recording_artists sra
set spotify_url = s.spotify_url
from public.songs s
where sra.song_id = s.id
  and s.spotify_url is not null
  and sra.position = (
    select min(position)
    from public.song_recording_artists
    where song_id = s.id
  );

alter table public.songs
  drop column if exists spotify_url;
