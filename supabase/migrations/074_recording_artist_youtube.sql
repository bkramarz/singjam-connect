alter table public.song_recording_artists
  add column if not exists youtube_url text;

-- Migrate existing songs.youtube_url to the primary (lowest position) recording artist row
update public.song_recording_artists sra
set youtube_url = s.youtube_url
from public.songs s
where sra.song_id = s.id
  and s.youtube_url is not null
  and sra.position = (
    select min(position)
    from public.song_recording_artists
    where song_id = s.id
  );
