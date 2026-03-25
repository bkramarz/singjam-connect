-- Migration 049: SECURITY DEFINER function for global song popularity counts
-- user_songs RLS restricts visibility to own rows, so we need a definer-rights
-- function to count across all users without exposing individual user data.

create or replace function public.song_popularity_counts()
returns table (song_id uuid, user_count bigint)
language sql
security definer
as $$
  select song_id, count(*) as user_count
  from public.user_songs
  group by song_id;
$$;
