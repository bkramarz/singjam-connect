-- ── Genres ────────────────────────────────────────────────────────────────────

-- A: merge "Hip-Hop" → "Hip-Hop/Rap"
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.genres where name = 'Hip-Hop';
  select id into new_id from public.genres where name = 'Hip-Hop/Rap';
  if old_id is not null and new_id is not null then
    update public.song_genres set genre_id = new_id
    where genre_id = old_id
      and not exists (select 1 from public.song_genres sg2 where sg2.song_id = song_genres.song_id and sg2.genre_id = new_id);
    delete from public.song_genres where genre_id = old_id;
    delete from public.genres where id = old_id;
  end if;
end $$;

-- B: merge "Heavy Metal" → "Metal"
do $$
declare
  old_id uuid;
  new_id uuid;
begin
  select id into old_id from public.genres where name = 'Heavy Metal';
  select id into new_id from public.genres where name = 'Metal';
  if old_id is not null and new_id is not null then
    update public.song_genres set genre_id = new_id
    where genre_id = old_id
      and not exists (select 1 from public.song_genres sg2 where sg2.song_id = song_genres.song_id and sg2.genre_id = new_id);
    delete from public.song_genres where genre_id = old_id;
    delete from public.genres where id = old_id;
  end if;
end $$;

-- C: remove "Christian" genre
do $$
declare
  christian_id uuid;
begin
  select id into christian_id from public.genres where name = 'Christian';
  if christian_id is not null then
    delete from public.song_genres where genre_id = christian_id;
    delete from public.genres where id = christian_id;
  end if;
end $$;


-- ── Themes ────────────────────────────────────────────────────────────────────

-- D: remove "Religion" theme
do $$
declare
  religion_id uuid;
begin
  select id into religion_id from public.themes where name = 'Religion';
  if religion_id is not null then
    delete from public.song_themes where theme_id = religion_id;
    delete from public.themes where id = religion_id;
  end if;
end $$;


-- ── Cultures ──────────────────────────────────────────────────────────────────

-- E: remove over-specific Christian denominations
delete from public.song_cultures
where culture_id in (
  select id from public.cultures
  where name in (
    'Anglican', 'Baptist', 'Coptic', 'Evangelical', 'Lutheran', 'Methodist',
    'Pentecostal', 'Presbyterian', 'Quaker', 'Seventh-day Adventist', 'Shaker',
    'Unitarian Universalist'
  )
);
delete from public.cultures
where name in (
  'Anglican', 'Baptist', 'Coptic', 'Evangelical', 'Lutheran', 'Methodist',
  'Pentecostal', 'Presbyterian', 'Quaker', 'Seventh-day Adventist', 'Shaker',
  'Unitarian Universalist'
);

-- F: merge "First Nations" + "Native American" → "First Nations/Native American"
do $$
declare
  fn_id  uuid;
  na_id  uuid;
  new_id uuid;
begin
  select id into fn_id from public.cultures where name = 'First Nations';
  select id into na_id from public.cultures where name = 'Native American';
  select id into new_id from public.cultures where name = 'First Nations/Native American';

  if new_id is null then
    insert into public.cultures (name) values ('First Nations/Native American') returning id into new_id;
  end if;

  if fn_id is not null then
    update public.song_cultures set culture_id = new_id
    where culture_id = fn_id
      and not exists (
        select 1 from public.song_cultures sc2
        where sc2.song_id = song_cultures.song_id
          and sc2.culture_id = new_id
          and sc2.context is not distinct from song_cultures.context
      );
    delete from public.song_cultures where culture_id = fn_id;
    delete from public.cultures where id = fn_id;
  end if;

  if na_id is not null then
    update public.song_cultures set culture_id = new_id
    where culture_id = na_id
      and not exists (
        select 1 from public.song_cultures sc2
        where sc2.song_id = song_cultures.song_id
          and sc2.culture_id = new_id
          and sc2.context is not distinct from song_cultures.context
      );
    delete from public.song_cultures where culture_id = na_id;
    delete from public.cultures where id = na_id;
  end if;
end $$;

-- G–J: remove "Gospel", "Secular", "Spiritual", "Indigenous" cultures
delete from public.song_cultures
where culture_id in (
  select id from public.cultures where name in ('Gospel', 'Secular', 'Spiritual', 'Indigenous')
);
delete from public.cultures where name in ('Gospel', 'Secular', 'Spiritual', 'Indigenous');

-- Rename "Mormon" → "Mormon/LDS" to match VALID_CULTURES
update public.cultures set name = 'Mormon/LDS' where name = 'Mormon';
