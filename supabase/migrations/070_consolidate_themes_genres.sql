-- Migration 070: Consolidate duplicate themes/genres and cap tags at 3 per song
--
-- Theme merges:
--   Faith / Spirit      → Faith
--   Isolation           → Loneliness
--   Grief               → Loss
--   Resistance          → Protest
--   Ecology             → Nature
--   Chill               → (drop — covered by vibe field)
--   Redemption          → Forgiveness
--   Community           → Unity
--   Adventure           → Wandering
--   Fatherhood          → Parenthood (new)
--   Motherhood          → Parenthood (new)
--
-- Genre merges:
--   Psychedelic         → Psychedelic Rock
--   Rap                 → Hip-Hop/Rap
--   Roots               → Roots Rock
--   Protest Songs       → (drop — it's a theme, not a genre)


-- ─────────────────────────────────────────
-- THEMES
-- ─────────────────────────────────────────

-- Add Parenthood
insert into public.themes (name) values ('Parenthood')
  on conflict (name) do nothing;


-- Helper: merge source theme into target, avoiding unique constraint violations
-- For each merge: update rows where source is used but target isn't on the same song,
-- then delete any remaining source rows (song already has the target), then drop source.

-- Faith / Spirit → Faith
update public.song_themes
  set theme_id = '87159b0c-95bc-4e65-9f5e-bbc5238f245f'  -- Faith
  where theme_id = 'c212b0bb-9a42-48df-857e-a6e7541b6b7a' -- Faith / Spirit
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = '87159b0c-95bc-4e65-9f5e-bbc5238f245f'
    );
delete from public.song_themes where theme_id = 'c212b0bb-9a42-48df-857e-a6e7541b6b7a';
delete from public.themes      where id        = 'c212b0bb-9a42-48df-857e-a6e7541b6b7a';

-- Isolation → Loneliness
update public.song_themes
  set theme_id = '01f5698e-5c7a-48ec-83b7-bdbb13546ea9'  -- Loneliness
  where theme_id = '37086a8d-5f44-4dec-a886-b7c272c721b9' -- Isolation
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = '01f5698e-5c7a-48ec-83b7-bdbb13546ea9'
    );
delete from public.song_themes where theme_id = '37086a8d-5f44-4dec-a886-b7c272c721b9';
delete from public.themes      where id        = '37086a8d-5f44-4dec-a886-b7c272c721b9';

-- Grief → Loss
update public.song_themes
  set theme_id = '176efcba-0b7b-4028-b68f-75573110a378'  -- Loss
  where theme_id = '81578dbe-cafa-46b0-ac84-0a23770fa5de' -- Grief
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = '176efcba-0b7b-4028-b68f-75573110a378'
    );
delete from public.song_themes where theme_id = '81578dbe-cafa-46b0-ac84-0a23770fa5de';
delete from public.themes      where id        = '81578dbe-cafa-46b0-ac84-0a23770fa5de';

-- Resistance → Protest
update public.song_themes
  set theme_id = 'a76b2354-0fd1-4fa3-b4b3-fb020dd382b5'  -- Protest
  where theme_id = '0413f0d4-1d93-4198-a5a4-4b424569fd74' -- Resistance
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = 'a76b2354-0fd1-4fa3-b4b3-fb020dd382b5'
    );
delete from public.song_themes where theme_id = '0413f0d4-1d93-4198-a5a4-4b424569fd74';
delete from public.themes      where id        = '0413f0d4-1d93-4198-a5a4-4b424569fd74';

-- Ecology → Nature
update public.song_themes
  set theme_id = '63774e51-97a5-4b4e-ba9b-d51f75732684'  -- Nature
  where theme_id = 'd846d0cc-dc7d-43a1-84b4-16b9b922b523' -- Ecology
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = '63774e51-97a5-4b4e-ba9b-d51f75732684'
    );
delete from public.song_themes where theme_id = 'd846d0cc-dc7d-43a1-84b4-16b9b922b523';
delete from public.themes      where id        = 'd846d0cc-dc7d-43a1-84b4-16b9b922b523';

-- Chill → drop (covered by vibe field)
delete from public.song_themes where theme_id = '6255cfa6-bcdd-417d-bd0d-f93d84bf6d7b';
delete from public.themes      where id        = '6255cfa6-bcdd-417d-bd0d-f93d84bf6d7b';

-- Redemption → Forgiveness
update public.song_themes
  set theme_id = 'b6520aac-9fa2-476b-955a-a852a22f195a'  -- Forgiveness
  where theme_id = 'f382fcdc-b80d-484f-b0f1-364fb3d65fa2' -- Redemption
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = 'b6520aac-9fa2-476b-955a-a852a22f195a'
    );
delete from public.song_themes where theme_id = 'f382fcdc-b80d-484f-b0f1-364fb3d65fa2';
delete from public.themes      where id        = 'f382fcdc-b80d-484f-b0f1-364fb3d65fa2';

-- Community → Unity
update public.song_themes
  set theme_id = 'c7509ef5-a8e9-4963-9f22-a383a795e1b6'  -- Unity
  where theme_id = 'b77b1fec-42e3-4d21-8c6a-57cf768e3636' -- Community
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = 'c7509ef5-a8e9-4963-9f22-a383a795e1b6'
    );
delete from public.song_themes where theme_id = 'b77b1fec-42e3-4d21-8c6a-57cf768e3636';
delete from public.themes      where id        = 'b77b1fec-42e3-4d21-8c6a-57cf768e3636';

-- Adventure → Wandering
update public.song_themes
  set theme_id = '16ce763a-6dc4-49cc-ac91-c25562e86d6c'  -- Wandering
  where theme_id = 'a721031b-b580-4819-b6b3-fd0cf2116fa9' -- Adventure
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = '16ce763a-6dc4-49cc-ac91-c25562e86d6c'
    );
delete from public.song_themes where theme_id = 'a721031b-b580-4819-b6b3-fd0cf2116fa9';
delete from public.themes      where id        = 'a721031b-b580-4819-b6b3-fd0cf2116fa9';

-- Fatherhood → Parenthood
update public.song_themes
  set theme_id = (select id from public.themes where name = 'Parenthood')
  where theme_id = '9dd7b606-c4ab-4aa6-aee0-28eba22a5256' -- Fatherhood
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = (select id from public.themes where name = 'Parenthood')
    );
delete from public.song_themes where theme_id = '9dd7b606-c4ab-4aa6-aee0-28eba22a5256';
delete from public.themes      where id        = '9dd7b606-c4ab-4aa6-aee0-28eba22a5256';

-- Motherhood → Parenthood
update public.song_themes
  set theme_id = (select id from public.themes where name = 'Parenthood')
  where theme_id = 'c62c512a-5f2d-4c61-85fe-29ffe7767a73' -- Motherhood
    and song_id not in (
      select song_id from public.song_themes
      where theme_id = (select id from public.themes where name = 'Parenthood')
    );
delete from public.song_themes where theme_id = 'c62c512a-5f2d-4c61-85fe-29ffe7767a73';
delete from public.themes      where id        = 'c62c512a-5f2d-4c61-85fe-29ffe7767a73';


-- ─────────────────────────────────────────
-- GENRES
-- ─────────────────────────────────────────

-- Psychedelic → Psychedelic Rock
update public.song_genres
  set genre_id = 'dadbebcd-e025-44d4-a2db-a0aa0d74cd94'  -- Psychedelic Rock
  where genre_id = '8af12891-9ccb-4087-815d-813a861874c4' -- Psychedelic
    and song_id not in (
      select song_id from public.song_genres
      where genre_id = 'dadbebcd-e025-44d4-a2db-a0aa0d74cd94'
    );
delete from public.song_genres where genre_id = '8af12891-9ccb-4087-815d-813a861874c4';
delete from public.genres      where id        = '8af12891-9ccb-4087-815d-813a861874c4';

-- Rap → Hip-Hop/Rap
update public.song_genres
  set genre_id = '19861221-c937-46b4-8d26-7c960e03b090'  -- Hip-Hop/Rap
  where genre_id = 'b357d587-fbdc-416a-a3bf-b66258d93ce0' -- Rap
    and song_id not in (
      select song_id from public.song_genres
      where genre_id = '19861221-c937-46b4-8d26-7c960e03b090'
    );
delete from public.song_genres where genre_id = 'b357d587-fbdc-416a-a3bf-b66258d93ce0';
delete from public.genres      where id        = 'b357d587-fbdc-416a-a3bf-b66258d93ce0';

-- Roots → Roots Rock
update public.song_genres
  set genre_id = 'd98689eb-8905-47e1-a037-a05661d2ca63'  -- Roots Rock
  where genre_id = 'c5a4a344-3e9a-4389-87fb-76e55816c1f7' -- Roots
    and song_id not in (
      select song_id from public.song_genres
      where genre_id = 'd98689eb-8905-47e1-a037-a05661d2ca63'
    );
delete from public.song_genres where genre_id = 'c5a4a344-3e9a-4389-87fb-76e55816c1f7';
delete from public.genres      where id        = 'c5a4a344-3e9a-4389-87fb-76e55816c1f7';

-- Protest Songs → drop (it's a theme, not a genre)
delete from public.song_genres where genre_id = 'c3b371b6-8c3c-4cf7-bb9c-30ff44979678';
delete from public.genres      where id        = 'c3b371b6-8c3c-4cf7-bb9c-30ff44979678';


-- ─────────────────────────────────────────
-- CAP: max 3 themes per song
-- Keep the 3 with the lowest theme_id (arbitrary but stable/deterministic)
-- ─────────────────────────────────────────
delete from public.song_themes
  where (song_id, theme_id) in (
    select song_id, theme_id
    from (
      select
        song_id,
        theme_id,
        row_number() over (partition by song_id order by theme_id) as rn
      from public.song_themes
    ) ranked
    where rn > 3
  );


-- ─────────────────────────────────────────
-- CAP: max 3 genres per song
-- ─────────────────────────────────────────
delete from public.song_genres
  where (song_id, genre_id) in (
    select song_id, genre_id
    from (
      select
        song_id,
        genre_id,
        row_number() over (partition by song_id order by genre_id) as rn
      from public.song_genres
    ) ranked
    where rn > 3
  );
