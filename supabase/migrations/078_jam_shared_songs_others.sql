-- Migration 078: extend jam_shared_songs to also return songs shared among other
-- participants that the viewer doesn't know, so the jam view shows a complete
-- picture of what everyone can play together.
--
-- Adds viewer_has boolean: true = viewer knows this song, false = others-only.
-- others-only songs require at least 2 participants and at least one leader.

drop function if exists public.jam_shared_songs(uuid);

create function public.jam_shared_songs(jam_id_param uuid)
returns table(
  song_id uuid,
  slug text,
  title text,
  display_artist text,
  viewer_has boolean,
  viewer_leads boolean,
  who_else text[],
  who_else_leads text[]
)
language sql
security definer
stable
set search_path = public
as $$
  with participants as (
    select j.host_user_id as user_id
    from public.jams j
    where j.id = jam_id_param
      and j.host_user_id <> auth.uid()

    union

    select r.user_id
    from public.jam_rsvps r
    where r.jam_id = jam_id_param
      and r.status = 'attending'
      and r.user_id <> auth.uid()
  ),
  viewer_songs as (
    select song_id
    from public.user_songs
    where user_id = auth.uid()
      and confidence in ('lead', 'support', 'follow')
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
      and vs.confidence in ('lead', 'support', 'follow')
      and os.confidence in ('lead', 'support', 'follow')
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
    where os.confidence in ('lead', 'support', 'follow')
      and s.id not in (select song_id from viewer_songs)
    group by s.id, s.slug, s.title, s.display_artist
    having count(distinct os.user_id) >= 2
      and bool_or(os.confidence = 'lead')
  )
  select * from (
    select * from viewer_shared
    union all
    select * from others_shared
  ) combined
  order by cardinality(who_else) desc, title;
$$;
