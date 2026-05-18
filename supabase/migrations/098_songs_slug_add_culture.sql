-- Recalculate slugs for traditional songs whose music culture is not yet in the slug.
-- Extends the work done in 097: appends the culture name (e.g. "Irish") for songs
-- that have Traditional as a composer and a song_cultures row with context = 'music'.
with new_slugs as (
  select
    s.id,
    s.slug as old_slug,
    regexp_replace(
      trim(regexp_replace(
        lower(concat_ws(' ',
          s.title,
          (select string_agg(p.name, ' ' order by p.name)
           from public.song_composers sc join public.people p on p.id = sc.person_id
           where sc.song_id = s.id),
          (select string_agg(p.name, ' ' order by p.name)
           from public.song_lyricists sl join public.people p on p.id = sl.person_id
           where sl.song_id = s.id),
          (select c.name
           from public.song_cultures sc
           join public.cultures c on c.id = sc.culture_id
           where sc.song_id = s.id and sc.context = 'music'
           limit 1)
        )),
        '[^a-z0-9[:space:]]', '', 'g'
      )),
      '[[:space:]]+', '-', 'g'
    ) as ideal_slug
  from public.songs s
  where exists (
    select 1 from public.song_cultures sc
    where sc.song_id = s.id and sc.context = 'music'
  )
),
changed as (
  select
    id,
    old_slug,
    case
      when exists (
        select 1 from public.songs other
        where other.slug = n.ideal_slug and other.id != n.id
      )
      then n.ideal_slug || '-' || floor(extract(epoch from now()))::text
      else n.ideal_slug
    end as final_slug
  from new_slugs n
  where n.ideal_slug != n.old_slug
    and n.ideal_slug is not null
    and n.ideal_slug != ''
)
update public.songs s
set slug        = c.final_slug,
    former_slug = coalesce(s.former_slug, c.old_slug)
from changed c
where s.id = c.id;
