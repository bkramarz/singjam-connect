-- Merge "Alternative" → "Alternative Rock"
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.genres where name = 'Alternative';
  select id into new_id from public.genres where name = 'Alternative Rock';

  if old_id is not null and new_id is not null then
    update public.song_genres set genre_id = new_id
    where genre_id = old_id
      and not exists (
        select 1 from public.song_genres sg2
        where sg2.song_id = song_genres.song_id
          and sg2.genre_id = new_id
      );
    delete from public.song_genres where genre_id = old_id;
    delete from public.genres where id = old_id;
  end if;
end $$;
