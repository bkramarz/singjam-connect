-- Genre names ordered by how many songs use them, for the account
-- favorite-genres picker. Replaces shipping the entire song_genres join
-- table to the client to count frequencies in JS.

create or replace function public.genres_by_usage()
returns table (name text)
language sql
stable
as $$
  select g.name
  from public.song_genres sg
  join public.genres g on g.id = sg.genre_id
  group by g.name
  order by count(*) desc, g.name
$$;

revoke execute on function public.genres_by_usage() from public, anon;
grant execute on function public.genres_by_usage() to authenticated, service_role;
