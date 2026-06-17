-- Migration 118: solo_set_songs RPC
-- Returns the current user's own repertoire songs for a set they own (no collaborators).
-- Includes global SingJam popularity so the popular sort is meaningful without other participants.

create function public.solo_set_songs(set_id_param uuid)
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
    and us.confidence in ('lead', 'support', 'follow')
    and exists (select 1 from viewer_is_participant)
  order by coalesce(gp.user_count, 0) desc, s.title;
$$;

grant execute on function public.solo_set_songs(uuid) to authenticated;
