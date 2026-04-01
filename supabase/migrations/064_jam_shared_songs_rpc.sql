-- Migration 064: RPC to find songs the viewer shares with jam participants
--
-- Returns each song the current user has in common with at least one other
-- person in the jam (host + RSVPd attendees), along with an array of the
-- names of those participants. The caller prepends "You" on the frontend.

create or replace function public.jam_shared_songs(jam_id_param uuid)
returns table(song_id uuid, title text, display_artist text, who_else text[])
language sql
security definer
stable
set search_path = public
as $$
  with participants as (
    -- Host, if they're not the viewer
    select j.host_user_id as user_id
    from public.jams j
    where j.id = jam_id_param
      and j.host_user_id <> auth.uid()

    union

    -- RSVPd attendees, excluding the viewer
    select r.user_id
    from public.jam_rsvps r
    where r.jam_id = jam_id_param
      and r.status = 'attending'
      and r.user_id <> auth.uid()
  )
  select
    s.id,
    s.title,
    s.display_artist,
    array_agg(distinct coalesce(nullif(trim(p.display_name), ''), p.username) order by coalesce(nullif(trim(p.display_name), ''), p.username)) as who_else
  from public.user_songs vs
  join public.user_songs os on os.song_id = vs.song_id
  join participants pt on pt.user_id = os.user_id
  join public.songs s on s.id = vs.song_id
  join public.profiles p on p.id = os.user_id
  where vs.user_id = auth.uid()
    and vs.confidence in ('lead', 'support', 'follow')
    and os.confidence in ('lead', 'support', 'follow')
  group by s.id, s.title, s.display_artist
  order by s.title;
$$;
