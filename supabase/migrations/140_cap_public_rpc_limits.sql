-- Migration 140: bound the inputs of the anon-callable SECURITY DEFINER RPCs
-- introduced in 137/139. Their limits were previously uncapped, so a caller
-- bypassing the UI could request arbitrarily expensive definer-rights queries:
--   1. browse_songs    — p_limit capped at 200 (scroll restore requests up to
--                        ~200 rows in one call; pagination covers the rest).
--   2. search_songs    — limit_n capped at 100 (largest app caller passes 100);
--                        also gains stable + set search_path = public for
--                        consistency with the other definer functions.
--   3. song_popularity_for — p_song_ids capped at the first 500 ids.

-- 1. browse_songs: identical to 137 except the limit clause.
create or replace function public.browse_songs(
  p_genres       text[] default null,
  p_languages    text[] default null,
  p_themes       text[] default null,
  p_cultures     text[] default null,
  p_vibe         text default null,
  p_tonality     text default null,
  p_meter        text default null,
  p_year_min     int default null,
  p_year_max     int default null,
  p_exclude_mine boolean default false,
  p_sort         text default 'popularity',
  p_offset       int default 0,
  p_limit        int default 20
)
returns table (
  song_id          uuid,
  title            text,
  slug             text,
  display_artist   text,
  composers        text[],
  cultures         text[],
  productions      text[],
  genres           text[],
  languages        text[],
  themes           text[],
  vibe             text,
  tonality         text,
  meter            text,
  year             int,
  popularity       bigint,
  youtube_id       text,
  spotify_track_id text,
  total_count      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with meta as (
    select
      s.id,
      s.title,
      s.vibe,
      s.tonality,
      s.meter,
      coalesce((select array_agg(g.name) from public.song_genres sg join public.genres g on g.id = sg.genre_id where sg.song_id = s.id), '{}') as genres,
      coalesce((select array_agg(l.name) from public.song_languages sl join public.languages l on l.id = sl.language_id where sl.song_id = s.id), '{}') as languages,
      coalesce((select array_agg(t.name) from public.song_themes st join public.themes t on t.id = st.theme_id where st.song_id = s.id), '{}') as themes,
      coalesce((select array_agg(c.name) from public.song_cultures scu join public.cultures c on c.id = scu.culture_id where scu.song_id = s.id), '{}') as cultures,
      least(s.year_written, (select min(sra.year) from public.song_recording_artists sra where sra.song_id = s.id)) as year,
      (select count(*) from public.user_songs us where us.song_id = s.id) as popularity
    from public.songs s
  ),
  filtered as (
    select m.*
    from meta m
    where (p_genres    is null or m.genres    && p_genres)
      and (p_languages is null or m.languages && p_languages)
      and (p_themes    is null or m.themes    && p_themes)
      and (p_cultures  is null or m.cultures  && p_cultures)
      and (p_vibe      is null or m.vibe  = p_vibe)
      and (p_meter     is null or m.meter = p_meter)
      and (p_tonality  is null or p_tonality = any(regexp_split_to_array(coalesce(m.tonality, ''), ',\s*')))
      and ((p_year_min is null and p_year_max is null)
        or (m.year is not null
            and (p_year_min is null or m.year >= p_year_min)
            and (p_year_max is null or m.year <= p_year_max)))
      and (not p_exclude_mine or not exists (
            select 1 from public.user_songs us
            where us.song_id = m.id and us.user_id = (select auth.uid())))
  ),
  page as (
    select f.*, count(*) over () as total_count
    from filtered f
    order by
      case when p_sort = 'title_asc'  then f.title end asc,
      case when p_sort = 'title_desc' then f.title end desc,
      case when p_sort not in ('title_asc', 'title_desc') then f.popularity end desc,
      f.title asc,
      f.id asc
    limit least(greatest(p_limit, 0), 200)
    offset greatest(p_offset, 0)
  )
  select
    s.id as song_id,
    s.title,
    s.slug,
    s.display_artist,
    coalesce((
      select array_agg(name order by name) from (
        select p.name from public.song_composers sc join public.people p on p.id = sc.person_id where sc.song_id = s.id
        union
        select p.name from public.song_lyricists sl join public.people p on p.id = sl.person_id where sl.song_id = s.id
      ) names
    ), '{}') as composers,
    pg.cultures,
    coalesce((select array_agg(pr.name) from public.song_productions sp join public.productions pr on pr.id = sp.production_id where sp.song_id = s.id), '{}') as productions,
    pg.genres,
    pg.languages,
    pg.themes,
    s.vibe,
    s.tonality,
    s.meter,
    pg.year,
    pg.popularity,
    coalesce(
      (select (regexp_match(sra.youtube_url, '(?:youtu\.be/|[?&]v=|/(?:embed|v|shorts)/)([a-zA-Z0-9_-]{11})'))[1]
       from public.song_recording_artists sra
       where sra.song_id = s.id and sra.youtube_url is not null
       order by sra.position nulls last limit 1),
      (regexp_match(s.youtube_url, '(?:youtu\.be/|[?&]v=|/(?:embed|v|shorts)/)([a-zA-Z0-9_-]{11})'))[1]
    ) as youtube_id,
    (select (regexp_match(sra.spotify_url, '/track/([a-zA-Z0-9]+)'))[1]
     from public.song_recording_artists sra
     where sra.song_id = s.id and sra.spotify_url is not null
     order by sra.position nulls last limit 1) as spotify_track_id,
    pg.total_count
  from page pg
  join public.songs s on s.id = pg.id
  order by
    case when p_sort = 'title_asc'  then pg.title end asc,
    case when p_sort = 'title_desc' then pg.title end desc,
    case when p_sort not in ('title_asc', 'title_desc') then pg.popularity end desc,
    pg.title asc,
    pg.id asc;
$$;

-- 2. search_songs: identical to 137 except stable, search_path, and the limit clause.
create or replace function public.search_songs(q text, limit_n int default 50)
returns table (
  song_id          uuid,
  title            text,
  display_artist   text,
  first_line       text,
  aka              text[],
  composers        text[],
  cultures         text[],
  productions      text[],
  genres           text[],
  languages        text[],
  themes           text[],
  vibe             text,
  tonality         text,
  meter            text,
  year             int,
  slug             text,
  score            float4,
  popularity       bigint,
  youtube_id       text,
  spotify_track_id text
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select regexp_replace(lower(q), '[^a-z0-9 ]', '', 'g') as nq
  ),
  matched as (
    select distinct s.id
    from public.songs s
    cross join normalized
    left join public.song_alternate_titles sat on sat.song_id = s.id
    left join public.song_composers sc on sc.song_id = s.id
    left join public.song_lyricists sl on sl.song_id = s.id
    left join public.people p on p.id = sc.person_id or p.id = sl.person_id
    left join public.song_productions sp on sp.song_id = s.id
    left join public.productions pr on pr.id = sp.production_id
    where
      s.title             ilike '%' || q || '%'
      or regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g')                    ilike '%' || normalized.nq || '%'
      or s.first_line     ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(s.first_line,'')), '[^a-z0-9 ]', '', 'g') ilike '%' || normalized.nq || '%'
      or s.hook           ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(s.hook,'')), '[^a-z0-9 ]', '', 'g')       ilike '%' || normalized.nq || '%'
      or s.notes          ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(s.notes,'')), '[^a-z0-9 ]', '', 'g')      ilike '%' || normalized.nq || '%'
      or s.display_artist ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(s.display_artist,'')), '[^a-z0-9 ]', '', 'g') ilike '%' || normalized.nq || '%'
      or sat.title        ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(sat.title,'')), '[^a-z0-9 ]', '', 'g')    ilike '%' || normalized.nq || '%'
      or p.name           ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(p.name,'')), '[^a-z0-9 ]', '', 'g')       ilike '%' || normalized.nq || '%'
      or pr.name          ilike '%' || q || '%'
      or regexp_replace(lower(coalesce(pr.name,'')), '[^a-z0-9 ]', '', 'g')      ilike '%' || normalized.nq || '%'
      or to_tsvector('english',
           coalesce(s.title, '') || ' ' ||
           coalesce(s.first_line, '') || ' ' ||
           coalesce(s.display_artist, '') || ' ' ||
           coalesce(s.notes, '')
         ) @@ plainto_tsquery('english', q)
  ),
  media as (
    select distinct on (song_id)
      song_id,
      youtube_url,
      spotify_url
    from public.song_recording_artists
    order by song_id, position nulls last
  )
  select
    s.id             as song_id,
    s.title,
    s.display_artist,
    s.first_line,
    coalesce(
      array_agg(distinct sat.title) filter (where sat.title is not null),
      '{}'::text[]
    )                as aka,
    coalesce(
      array_agg(distinct p.name) filter (where p.name is not null),
      '{}'::text[]
    )                as composers,
    coalesce(
      array_agg(distinct c.name) filter (where c.name is not null),
      '{}'::text[]
    )                as cultures,
    coalesce(
      array_agg(distinct pr.name) filter (where pr.name is not null),
      '{}'::text[]
    )                as productions,
    coalesce(
      array_agg(distinct g.name) filter (where g.name is not null),
      '{}'::text[]
    )                as genres,
    coalesce(
      array_agg(distinct l.name) filter (where l.name is not null),
      '{}'::text[]
    )                as languages,
    coalesce(
      array_agg(distinct t.name) filter (where t.name is not null),
      '{}'::text[]
    )                as themes,
    s.vibe,
    s.tonality,
    s.meter,
    least(
      s.year_written,
      min(sra.year)
    )                as year,
    s.slug,
    ts_rank(
      to_tsvector('english',
        coalesce(s.title, '') || ' ' ||
        coalesce(s.first_line, '') || ' ' ||
        coalesce(s.display_artist, '') || ' ' ||
        coalesce(s.notes, '') || ' ' ||
        coalesce(string_agg(distinct p.name, ' '), '') || ' ' ||
        coalesce(string_agg(distinct pr.name, ' '), '')
      ),
      plainto_tsquery('english', q)
    )                as score,
    (select count(*) from public.user_songs us where us.song_id = s.id) as popularity,
    (regexp_match(
      coalesce(med.youtube_url, s.youtube_url),
      '(?:youtu\.be/|[?&]v=|/(?:embed|v|shorts)/)([a-zA-Z0-9_-]{11})'
    ))[1]            as youtube_id,
    (regexp_match(
      med.spotify_url,
      '/track/([a-zA-Z0-9]+)'
    ))[1]            as spotify_track_id
  from matched m
  join public.songs s on s.id = m.id
  left join public.song_alternate_titles sat on sat.song_id = s.id
  left join public.song_composers sc on sc.song_id = s.id
  left join public.song_lyricists sl on sl.song_id = s.id
  left join public.people p on p.id = sc.person_id or p.id = sl.person_id
  left join public.song_cultures scu on scu.song_id = s.id
  left join public.cultures c on c.id = scu.culture_id
  left join public.song_recording_artists sra on sra.song_id = s.id
  left join public.song_productions sp on sp.song_id = s.id
  left join public.productions pr on pr.id = sp.production_id
  left join public.song_genres sg on sg.song_id = s.id
  left join public.genres g on g.id = sg.genre_id
  left join public.song_languages sl2 on sl2.song_id = s.id
  left join public.languages l on l.id = sl2.language_id
  left join public.song_themes st on st.song_id = s.id
  left join public.themes t on t.id = st.theme_id
  left join media med on med.song_id = s.id
  group by s.id, med.youtube_url, med.spotify_url
  order by score desc, s.title
  limit least(greatest(limit_n, 0), 100);
$$;

-- 3. song_popularity_for: identical to 139 except the input slice.
create or replace function public.song_popularity_for(p_song_ids uuid[])
returns table (song_id uuid, user_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select song_id, count(*) as user_count
  from public.user_songs
  where song_id = any(p_song_ids[1:500])
  group by song_id;
$$;
