-- Migration 082: improve search_songs with per-word prefix matching and better relevance ordering
--
-- Fixes two issues:
--   1. "Dreams fleet" returned nothing because the query was matched as a single phrase.
--      Now each word becomes a prefix token ('dreams':* & 'fleet':*) so partial words like
--      "fleet" match "fleetwood".
--   2. "She Loves You" returned ~46 results because the english-dictionary FTS stripped stop
--      words ("she", "you"), leaving only "love" — matching every song about love.
--      Switching to the simple dictionary preserves all query words, and removing the notes
--      column from matching eliminates false positives from songs that reference other songs
--      in their notes text.
--
-- Ordering is now multi-tier: exact title match → title-prefix → title-contains → FTS score.

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
  genres         text[],
  year           int,
  slug           text,
  score          float4
)
language sql
security definer
as $$
  with nq_words as (
    -- Split and clean the query into individual words
    select word, row_number() over () as rn
    from regexp_split_to_table(
      trim(regexp_replace(lower(q), '[^a-z0-9 ]', ' ', 'g')),
      '\s+'
    ) as word
    where length(word) > 0
  ),
  normalized as (
    select
      -- Reassemble into a clean phrase for substring matching
      coalesce(string_agg(word, ' ' order by rn), '') as nq,
      -- Build a prefix tsquery: 'word1':* & 'word2':* & ...
      -- "fleet" matches "fleetwood"; "dream" matches "dreams"
      case when count(*) > 0
        then to_tsquery('simple', string_agg(word || ':*', ' & ' order by rn))
        else null
      end as prefix_q
    from nq_words
  ),
  matched as (
    select distinct s.id
    from public.songs s
    cross join normalized
    left join public.song_alternate_titles sat on sat.song_id = s.id
    left join public.song_composers sc on sc.song_id = s.id
    left join public.song_lyricists sl on sl.song_id = s.id
    left join public.people p on p.id = sc.person_id or p.id = sl.person_id
    left join public.song_productions sp on sp.song_id = s.id
    left join public.productions pr on pr.id = sp.production_id
    where
      -- Phrase-substring matching on key fields (notes excluded: too noisy)
      regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g')                            ilike '%' || normalized.nq || '%'
      or regexp_replace(lower(coalesce(sat.title, '')), '[^a-z0-9 ]', '', 'g')          ilike '%' || normalized.nq || '%'
      or regexp_replace(lower(coalesce(s.first_line, '')), '[^a-z0-9 ]', '', 'g')       ilike '%' || normalized.nq || '%'
      or regexp_replace(lower(coalesce(s.hook, '')), '[^a-z0-9 ]', '', 'g')             ilike '%' || normalized.nq || '%'
      or regexp_replace(lower(coalesce(s.display_artist, '')), '[^a-z0-9 ]', '', 'g')  ilike '%' || normalized.nq || '%'
      or regexp_replace(lower(coalesce(p.name, '')), '[^a-z0-9 ]', '', 'g')             ilike '%' || normalized.nq || '%'
      or regexp_replace(lower(coalesce(pr.name, '')), '[^a-z0-9 ]', '', 'g')            ilike '%' || normalized.nq || '%'
      -- Per-word prefix match: every query word must appear as a token prefix
      or (normalized.prefix_q is not null and
          to_tsvector('simple',
            coalesce(s.title, '') || ' ' ||
            coalesce(s.display_artist, '') || ' ' ||
            coalesce(s.first_line, '') || ' ' ||
            coalesce(s.hook, '') || ' ' ||
            coalesce(p.name, '') || ' ' ||
            coalesce(pr.name, '')
          ) @@ normalized.prefix_q)
  )
  select
    s.id             as song_id,
    s.title,
    s.display_artist,
    s.first_line,
    coalesce(array_agg(distinct sat.title) filter (where sat.title is not null), '{}'::text[]) as aka,
    coalesce(array_agg(distinct p.name)    filter (where p.name    is not null), '{}'::text[]) as composers,
    coalesce(array_agg(distinct c.name)    filter (where c.name    is not null), '{}'::text[]) as cultures,
    coalesce(array_agg(distinct pr.name)   filter (where pr.name   is not null), '{}'::text[]) as productions,
    coalesce(array_agg(distinct g.name)    filter (where g.name    is not null), '{}'::text[]) as genres,
    least(s.year_written, min(sra.year))   as year,
    s.slug,
    coalesce(
      ts_rank(
        to_tsvector('simple',
          coalesce(s.title, '') || ' ' ||
          coalesce(s.first_line, '') || ' ' ||
          coalesce(s.display_artist, '') || ' ' ||
          coalesce(string_agg(distinct p.name, ' '), '') || ' ' ||
          coalesce(string_agg(distinct pr.name, ' '), '')
        ),
        (select prefix_q from normalized)
      ),
      0::float4
    )                as score
  from matched m
  join public.songs s on s.id = m.id
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
  left join public.song_genres sg on sg.song_id = s.id
  left join public.genres g on g.id = sg.genre_id
  group by s.id, s.title, s.display_artist, s.first_line, s.year_written, s.slug, normalized.nq
  order by
    -- Exact normalized title match
    (regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g') = normalized.nq)::int desc,
    -- Title begins with the query phrase
    (regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g') ilike normalized.nq || '%')::int desc,
    -- Title contains the query phrase
    (regexp_replace(lower(s.title), '[^a-z0-9 ]', '', 'g') ilike '%' || normalized.nq || '%')::int desc,
    -- FTS prefix relevance score
    score desc,
    s.title
  limit limit_n;
$$;
