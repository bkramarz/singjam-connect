-- Migration 002: add search_songs RPC and tighten jam RLS policies

-- search_songs: full-text search on title and artist
create or replace function public.search_songs(q text, limit_n int default 50)
returns table (
  song_id uuid,
  title   text,
  display_artist text,
  aka     text[],
  score   float4
)
language sql
security definer
as $$
  select
    s.id          as song_id,
    s.title,
    s.artist      as display_artist,
    '{}'::text[]  as aka,
    ts_rank(
      to_tsvector('english', coalesce(s.title, '') || ' ' || coalesce(s.artist, '')),
      plainto_tsquery('english', q)
    )             as score
  from public.songs s
  where
    to_tsvector('english', coalesce(s.title, '') || ' ' || coalesce(s.artist, ''))
      @@ plainto_tsquery('english', q)
    or s.title  ilike '%' || q || '%'
    or s.artist ilike '%' || q || '%'
  order by score desc, s.title
  limit limit_n;
$$;

-- Fix jam RLS: enforce visibility column and restrict write access
drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'radius'
    or auth.uid() = host_user_id
  );

create policy "update own jam" on public.jams
  for update using (auth.uid() = host_user_id);

create policy "delete own jam" on public.jams
  for delete using (auth.uid() = host_user_id);
