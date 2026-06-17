-- Migration 119: fix 'follow' → 'learn' in set_shared_songs and solo_set_songs
-- Migration 051 removed 'follow' from the confidence enum (migrating rows to 'support')
-- and added 'learn'. Migrations 117 and 118 were written with 'follow', so any user
-- who recorded songs with 'learn' confidence was silently excluded from suggestions.

create or replace function public.set_shared_songs(set_id_param uuid)
returns table(
  song_id uuid,
  slug text,
  title text,
  display_artist text,
  viewer_has boolean,
  viewer_leads boolean,
  who_else text[],
  who_else_leads text[],
  in_set boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with viewer_is_participant as (
    select 1
    from public.sets s
    where s.id = set_id_param and s.owner_user_id = auth.uid()
    union all
    select 1
    from public.set_collaborators sc
    where sc.set_id = set_id_param
      and sc.user_id = auth.uid()
      and sc.status = 'accepted'
  ),
  participants as (
    select s.owner_user_id as user_id
    from public.sets s
    where s.id = set_id_param
      and s.owner_user_id <> auth.uid()

    union

    select sc.user_id
    from public.set_collaborators sc
    where sc.set_id = set_id_param
      and sc.status = 'accepted'
      and sc.user_id <> auth.uid()
      and sc.user_id is not null
  ),
  viewer_songs as (
    select song_id
    from public.user_songs
    where user_id = auth.uid()
      and confidence in ('lead', 'support', 'learn')
  ),
  matches as (
    select
      vs.song_id,
      vs.confidence                                                   as viewer_conf,
      coalesce(nullif(trim(p.display_name), ''), p.username)         as other_name,
      os.confidence                                                   as other_conf
    from public.user_songs vs
    join public.user_songs os on os.song_id = vs.song_id
    join participants pt on pt.user_id = os.user_id
    join public.profiles p on p.id = os.user_id
    where vs.user_id = auth.uid()
      and vs.confidence in ('lead', 'support', 'learn')
      and os.confidence in ('lead', 'support', 'learn')
      and exists (select 1 from viewer_is_participant)
  ),
  viewer_shared as (
    select
      s.id                                                                                             as song_id,
      s.slug,
      s.title,
      s.display_artist,
      true                                                                                             as viewer_has,
      bool_or(m.viewer_conf = 'lead')                                                                 as viewer_leads,
      array_agg(distinct m.other_name order by m.other_name)                                          as who_else,
      coalesce(array_agg(distinct m.other_name order by m.other_name) filter (where m.other_conf = 'lead'), '{}') as who_else_leads
    from matches m
    join public.songs s on s.id = m.song_id
    group by s.id, s.slug, s.title, s.display_artist
    having bool_or(m.viewer_conf = 'lead') or bool_or(m.other_conf = 'lead')
  ),
  others_shared as (
    select
      s.id                                                                                             as song_id,
      s.slug,
      s.title,
      s.display_artist,
      false                                                                                            as viewer_has,
      false                                                                                            as viewer_leads,
      array_agg(distinct coalesce(nullif(trim(p.display_name), ''), p.username) order by coalesce(nullif(trim(p.display_name), ''), p.username)) as who_else,
      coalesce(array_agg(distinct coalesce(nullif(trim(p.display_name), ''), p.username) order by coalesce(nullif(trim(p.display_name), ''), p.username)) filter (where os.confidence = 'lead'), '{}') as who_else_leads
    from public.user_songs os
    join participants pt on pt.user_id = os.user_id
    join public.songs s on s.id = os.song_id
    join public.profiles p on p.id = os.user_id
    where os.confidence in ('lead', 'support', 'learn')
      and s.id not in (select song_id from viewer_songs)
      and exists (select 1 from viewer_is_participant)
    group by s.id, s.slug, s.title, s.display_artist
    having count(distinct os.user_id) >= 1
      and bool_or(os.confidence = 'lead')
  ),
  set_songs_already as (
    select song_id
    from public.set_songs
    where set_id = set_id_param
  )
  select
    combined.song_id,
    combined.slug,
    combined.title,
    combined.display_artist,
    combined.viewer_has,
    combined.viewer_leads,
    combined.who_else,
    combined.who_else_leads,
    exists (select 1 from set_songs_already where song_id = combined.song_id) as in_set
  from (
    select * from viewer_shared
    union all
    select * from others_shared
  ) combined
  order by cardinality(who_else) desc, title;
$$;

create or replace function public.solo_set_songs(set_id_param uuid)
returns table(
  song_id     uuid,
  slug        text,
  title       text,
  display_artist text,
  viewer_has  boolean,
  viewer_leads boolean,
  who_else    text[],
  who_else_leads text[],
  in_set      boolean,
  popularity  bigint
)
language sql
security definer
stable
set search_path = public
as $$
  with viewer_is_participant as (
    select 1 from public.sets
    where id = set_id_param and owner_user_id = auth.uid()
    union all
    select 1 from public.set_collaborators sc
    where sc.set_id = set_id_param
      and sc.user_id = auth.uid()
      and sc.status = 'accepted'
  ),
  set_songs_already as (
    select song_id from public.set_songs
    where set_id = set_id_param
  ),
  global_popularity as (
    select song_id, count(*) as user_count
    from public.user_songs
    group by song_id
  )
  select
    s.id                                                              as song_id,
    s.slug,
    s.title,
    s.display_artist,
    true                                                              as viewer_has,
    (us.confidence = 'lead')                                          as viewer_leads,
    '{}'::text[]                                                      as who_else,
    '{}'::text[]                                                      as who_else_leads,
    exists (select 1 from set_songs_already where song_id = s.id)    as in_set,
    coalesce(gp.user_count, 0)                                        as popularity
  from public.user_songs us
  join public.songs s on s.id = us.song_id
  left join global_popularity gp on gp.song_id = s.id
  where us.user_id = auth.uid()
    and us.confidence in ('lead', 'support', 'learn')
    and exists (select 1 from viewer_is_participant)
  order by coalesce(gp.user_count, 0) desc, s.title;
$$;
