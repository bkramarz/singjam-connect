-- ── Renames ───────────────────────────────────────────────────────────────────
update public.genres set name = 'Children''s Music' where name = 'Children/Kids';
update public.genres set name = 'Hip-Hop & Rap'    where name = 'Hip-Hop/Rap';
update public.genres set name = 'Indie Rock'        where name = 'Indie';

-- ── Merges ────────────────────────────────────────────────────────────────────

-- Broadway → Musical
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.genres where name = 'Broadway';
  select id into new_id from public.genres where name = 'Musical';
  if old_id is not null and new_id is not null then
    update public.song_genres set genre_id = new_id
    where genre_id = old_id
      and not exists (
        select 1 from public.song_genres sg2
        where sg2.song_id = song_genres.song_id and sg2.genre_id = new_id
      );
    delete from public.song_genres where genre_id = old_id;
    delete from public.genres where id = old_id;
  end if;
end $$;

-- Rhythm & Blues/R&B → R&B
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.genres where name = 'Rhythm & Blues/R&B';
  select id into new_id from public.genres where name = 'R&B';
  if old_id is not null and new_id is not null then
    update public.song_genres set genre_id = new_id
    where genre_id = old_id
      and not exists (
        select 1 from public.song_genres sg2
        where sg2.song_id = song_genres.song_id and sg2.genre_id = new_id
      );
    delete from public.song_genres where genre_id = old_id;
    delete from public.genres where id = old_id;
  end if;
end $$;

-- ── Drops ─────────────────────────────────────────────────────────────────────
delete from public.song_genres
where genre_id in (
  select id from public.genres
  where name in (
    'Acoustic', 'Dream Pop', 'Jewish', 'Opera', 'Shoegaze',
    'Soundtrack', 'Traditional', 'Work Songs', 'World', 'Worship/Praise'
  )
);

delete from public.genres
where name in (
  'Acoustic', 'Dream Pop', 'Jewish', 'Opera', 'Shoegaze',
  'Soundtrack', 'Traditional', 'Work Songs', 'World', 'Worship/Praise'
);
