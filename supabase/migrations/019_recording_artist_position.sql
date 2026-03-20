-- Migration 019: add position to song_recording_artists for preferred display order

alter table public.song_recording_artists add column if not exists position integer;

-- Seed existing rows with position based on year asc
update public.song_recording_artists sra
set position = sub.rn
from (
  select song_id, artist_id,
    row_number() over (partition by song_id order by year asc nulls last) as rn
  from public.song_recording_artists
) sub
where sra.song_id = sub.song_id and sra.artist_id = sub.artist_id;
