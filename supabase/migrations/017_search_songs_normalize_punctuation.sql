-- Migration 017: normalize punctuation in search so "ill fly away" matches "i'll fly away"

create or replace function public.search_songs(q text, limit_n int default 50)
returns table (
  song_id        uuid,
  title          text,
  display_artist text,
  first_line     text,
  aka            text[],
  score          float4
)
language sql
security definer
as $$
  with normalized as (
    -- strip everything except letters, digits, and spaces from the query
    select regexp_replace(lower(q), '[^a-z0-9 ]', '', 'g') as nq
  )
  select
    s.id             as song_id,
    s.title,
    s.display_artist,
    s.first_line,
    coalesce(
      array_agg(distinct sat.title) filter (where sat.title is not null),
      '{}'::text[]
    )                as aka,
    ts_rank(
      to_tsvector('english',
        coalesce(s.title, '') || ' ' ||
        coalesce(s.first_line, '') || ' ' ||
        coalesce(s.hook, '') || ' ' ||
        coalesce(s.display_artist, '') || ' ' ||
        coalesce(string_agg(distinct p.name, ' '), '')
      ),
      plainto_tsquery('english', q)
    )                as score
  from public.songs s
  cross join normalized
  left join public.song_alternate_titles sat on sat.song_id = s.id
  left join public.song_composers sc on sc.song_id = s.id
  left join public.song_lyricists sl on sl.song_id = s.id
  left join public.people p on p.id = sc.person_id or p.id = sl.person_id
  where
    s.title             ilike '%' || q || '%'
    or regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g')        ilike '%' || normalized.nq || '%'
    or s.first_line     ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(s.first_line,'')), '[^a-z0-9 ]', '', 'g') ilike '%' || normalized.nq || '%'
    or s.hook           ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(s.hook,'')), '[^a-z0-9 ]', '', 'g')       ilike '%' || normalized.nq || '%'
    or s.display_artist ilike '%' || q || '%'
    or sat.title        ilike '%' || q || '%'
    or p.name           ilike '%' || q || '%'
    or to_tsvector('english',
         coalesce(s.title, '') || ' ' ||
         coalesce(s.first_line, '') || ' ' ||
         coalesce(s.hook, '') || ' ' ||
         coalesce(s.display_artist, '')
       ) @@ plainto_tsquery('english', q)
  group by s.id
  order by score desc, s.title
  limit limit_n;
$$;
