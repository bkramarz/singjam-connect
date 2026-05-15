-- Remove "Irish" and "Scottish" genres (these are cultures, not genres)
delete from public.song_genres
where genre_id in (
  select id from public.genres where name in ('Irish', 'Scottish')
);

delete from public.genres where name in ('Irish', 'Scottish');
