-- Migration 031: restore apostrophe/punctuation normalization lost in 030

drop function if exists public.search_songs(text, int);
create or replace function public.search_songs(q text, limit_n int default 50)
returns table (
  song_id        uuid,
  title          text,
  display_artist text,
  first_line     text,
  aka            text[],
  composers      text[],
  cultures       text[],
  productions    text[],
  year           int,
  slug           text,
  score          float4
)
language sql
security definer
as $$
  with normalized as (
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
    coalesce(
      array_agg(distinct p.name) filter (where p.name is not null),
      '{}'::text[]
    )                as composers,
    coalesce(
      array_agg(distinct c.name) filter (where c.name is not null),
      '{}'::text[]
    )                as cultures,
    coalesce(
      array_agg(distinct pr.name) filter (where pr.name is not null),
      '{}'::text[]
    )                as productions,
    least(
      s.year_written,
      min(sra.year)
    )                as year,
    s.slug,
    ts_rank(
      to_tsvector('english',
        coalesce(s.title, '') || ' ' ||
        coalesce(s.first_line, '') || ' ' ||
        coalesce(s.display_artist, '') || ' ' ||
        coalesce(string_agg(distinct p.name, ' '), '') || ' ' ||
        coalesce(string_agg(distinct pr.name, ' '), '')
      ),
      plainto_tsquery('english', q)
    )                as score
  from public.songs s
  cross join normalized
  left join public.song_alternate_titles sat on sat.song_id = s.id
  left join public.song_composers sc on sc.song_id = s.id
  left join public.song_lyricists sl on sl.song_id = s.id
  left join public.people p on p.id = sc.person_id or p.id = sl.person_id
  left join public.song_cultures scu on scu.song_id = s.id
  left join public.cultures c on c.id = scu.culture_id
  left join public.song_recording_artists sra on sra.song_id = s.id
  left join public.song_productions sp on sp.song_id = s.id
  left join public.productions pr on pr.id = sp.production_id
  where
    s.title             ilike '%' || q || '%'
    or regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g')                    ilike '%' || normalized.nq || '%'
    or s.first_line     ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(s.first_line,'')), '[^a-z0-9 ]', '', 'g') ilike '%' || normalized.nq || '%'
    or s.hook           ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(s.hook,'')), '[^a-z0-9 ]', '', 'g')       ilike '%' || normalized.nq || '%'
    or s.display_artist ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(s.display_artist,'')), '[^a-z0-9 ]', '', 'g') ilike '%' || normalized.nq || '%'
    or sat.title        ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(sat.title,'')), '[^a-z0-9 ]', '', 'g')    ilike '%' || normalized.nq || '%'
    or p.name           ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(p.name,'')), '[^a-z0-9 ]', '', 'g')       ilike '%' || normalized.nq || '%'
    or pr.name          ilike '%' || q || '%'
    or regexp_replace(lower(coalesce(pr.name,'')), '[^a-z0-9 ]', '', 'g')      ilike '%' || normalized.nq || '%'
    or to_tsvector('english',
         coalesce(s.title, '') || ' ' ||
         coalesce(s.first_line, '') || ' ' ||
         coalesce(s.display_artist, '')
       ) @@ plainto_tsquery('english', q)
  group by s.id
  order by score desc, s.title
  limit limit_n;
$$;
