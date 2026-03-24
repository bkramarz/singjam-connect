drop function if exists public.match_jammers(uuid, int);

create or replace function public.match_jammers(for_user_id uuid, limit_n int default 30)
returns table (
  user_id uuid,
  display_name text,
  last_name text,
  username text,
  avatar_url text,
  neighborhood text,
  singing_voice text,
  instrument_levels jsonb,
  shared_count int,
  top_shared text[],
  shared_genres text[],
  genre_overlap_count int
)
language sql
security definer
as $$
  with my as (
    select song_id, confidence
    from public.user_songs
    where user_id = for_user_id
      and confidence in ('lead','support','follow')
  ),
  my_profile as (
    select favorite_genres
    from public.profiles
    where id = for_user_id
  ),
  others as (
    select us.user_id, us.song_id
    from public.user_songs us
    where us.user_id <> for_user_id
      and us.confidence in ('lead','support','follow')
  ),
  song_overlaps as (
    select o.user_id, count(*)::int as shared_count
    from others o
    join my on my.song_id = o.song_id
    group by o.user_id
  ),
  top_songs as (
    select o.user_id,
           array_agg(s.title order by s.title) filter (where s.title is not null) as titles
    from others o
    join my on my.song_id = o.song_id
    join public.songs s on s.id = o.song_id
    group by o.user_id
  ),
  genre_overlaps as (
    select p.id as user_id,
           array(
             select unnest(p.favorite_genres)
             intersect
             select unnest(mp.favorite_genres)
             from my_profile mp
           ) as shared_genres
    from public.profiles p
    where p.id <> for_user_id
      and p.favorite_genres is not null
  )
  select
    p.id as user_id,
    p.display_name,
    p.last_name,
    p.username,
    p.avatar_url,
    p.neighborhood,
    p.singing_voice,
    p.instrument_levels::jsonb,
    ov.shared_count,
    coalesce(ts.titles[1:10], '{}'::text[]) as top_shared,
    coalesce(go.shared_genres, '{}'::text[]) as shared_genres,
    coalesce(array_length(go.shared_genres, 1), 0) as genre_overlap_count
  from song_overlaps ov
  join public.profiles p on p.id = ov.user_id
  left join top_songs ts on ts.user_id = ov.user_id
  left join genre_overlaps go on go.user_id = ov.user_id
  where ov.shared_count > 0
  order by (ov.shared_count + coalesce(array_length(go.shared_genres, 1), 0)) desc
  limit limit_n;
$$;
