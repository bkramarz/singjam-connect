-- Scoped variant of song_popularity_counts (049): global user counts for the
-- given songs only, so callers don't pay for a full user_songs aggregate.
-- user_songs RLS restricts visibility to own rows, so definer rights are
-- needed to count across all users without exposing individual user data.
-- Anon can execute: public solo sets show the Popular sort to signed-out
-- viewers, and only aggregate counts are returned (same exposure as 049).

create or replace function public.song_popularity_for(p_song_ids uuid[])
returns table (song_id uuid, user_count bigint)
language sql
security definer
set search_path = public
as $$
  select song_id, count(*) as user_count
  from public.user_songs
  where song_id = any(p_song_ids)
  group by song_id;
$$;

revoke execute on function public.song_popularity_for(uuid[]) from public;
grant execute on function public.song_popularity_for(uuid[]) to anon, authenticated, service_role;
