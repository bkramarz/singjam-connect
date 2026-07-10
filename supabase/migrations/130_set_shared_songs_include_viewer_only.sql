-- set_shared_songs previously only returned a song the viewer knows if it
-- also matched another participant's repertoire (via the `matches` CTE,
-- which requires a join to another participant's user_songs row). A song
-- only the viewer knew — nobody else in the set knew it at all — never
-- appeared anywhere in the result: not in viewer_shared (no match row
-- exists to build from) and not in others_shared (that CTE is scoped to
-- other participants' songs). The "Add songs" panel should always show the
-- viewer's own full repertoire, so viewer_shared is rebuilt here to start
-- from every song the viewer knows and left-join in other participants'
-- knowledge, rather than requiring a match to exist in the first place.
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
    select song_id, confidence
    from public.user_songs
    where user_id = auth.uid()
      and confidence in ('lead', 'support', 'learn')
      and exists (select 1 from viewer_is_participant)
  ),
  others_knowledge as (
    select
      os.song_id,
      coalesce(nullif(trim(p.display_name), ''), p.username) as other_name,
      os.confidence                                           as other_conf
    from public.user_songs os
    join participants pt on pt.user_id = os.user_id
    join public.profiles p on p.id = os.user_id
    where os.confidence in ('lead', 'support', 'learn')
  ),
  viewer_shared as (
    select
      s.id                                                                                            as song_id,
      s.slug,
      s.title,
      s.display_artist,
      true                                                                                            as viewer_has,
      bool_or(vs.confidence = 'lead')                                                                  as viewer_leads,
      coalesce(array_agg(distinct ok.other_name order by ok.other_name) filter (where ok.other_name is not null), '{}') as who_else,
      coalesce(array_agg(distinct ok.other_name order by ok.other_name) filter (where ok.other_conf = 'lead'), '{}')   as who_else_leads
    from viewer_songs vs
    join public.songs s on s.id = vs.song_id
    left join others_knowledge ok on ok.song_id = vs.song_id
    group by s.id, s.slug, s.title, s.display_artist
  ),
  others_shared as (
    select
      s.id                                                                                            as song_id,
      s.slug,
      s.title,
      s.display_artist,
      false                                                                                           as viewer_has,
      false                                                                                           as viewer_leads,
      array_agg(distinct ok.other_name order by ok.other_name)                                        as who_else,
      coalesce(array_agg(distinct ok.other_name order by ok.other_name) filter (where ok.other_conf = 'lead'), '{}') as who_else_leads
    from others_knowledge ok
    join public.songs s on s.id = ok.song_id
    where ok.song_id not in (select song_id from viewer_songs)
      and exists (select 1 from viewer_is_participant)
    group by s.id, s.slug, s.title, s.display_artist
    having bool_or(ok.other_conf = 'lead')
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
  order by (cardinality(combined.who_else) = 0), cardinality(combined.who_else) desc, combined.title;
$$;
