-- Migration 065: update jam_shared_songs to filter by leadership and expose leaders
--
-- Only return songs where at least one person (viewer or participant) can lead.
-- Also returns viewer_leads (bool) and who_else_leads (names of leading participants)
-- so the frontend can bold the leaders.

drop function if exists public.jam_shared_songs(uuid);

create function public.jam_shared_songs(jam_id_param uuid)
returns table(
  song_id uuid,
  title text,
  display_artist text,
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
  matches as (
    select
      vs.song_id,
      vs.confidence                                                        as viewer_conf,
      coalesce(nullif(trim(p.display_name), ''), p.username)              as other_name,
      os.confidence                                                        as other_conf
    from public.user_songs vs
    join public.user_songs os on os.song_id = vs.song_id
    join participants pt on pt.user_id = os.user_id
    join public.profiles p on p.id = os.user_id
    where vs.user_id = auth.uid()
      and vs.confidence in ('lead', 'support', 'follow')
      and os.confidence in ('lead', 'support', 'follow')
  )
  select
    s.id,
    s.title,
    s.display_artist,
    bool_or(m.viewer_conf = 'lead')                                                               as viewer_leads,
    array_agg(distinct m.other_name order by m.other_name)                                        as who_else,
    coalesce(array_agg(distinct m.other_name order by m.other_name) filter (where m.other_conf = 'lead'), '{}') as who_else_leads
  from matches m
  join public.songs s on s.id = m.song_id
  group by s.id, s.title, s.display_artist
  having bool_or(m.viewer_conf = 'lead') or bool_or(m.other_conf = 'lead')
  order by s.title;
$$;
