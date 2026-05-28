-- Corrective pass: recalculate slugs using a deduplicated union of composers and
-- lyricists, plus music culture. Fixes cases where migrations 097/098 produced
-- repeated names (e.g. "traditional-traditional-irish") when the same person
-- appeared in both song_composers and song_lyricists.
with new_slugs as (
  select
    s.id,
    s.slug as old_slug,
    regexp_replace(
      trim(regexp_replace(
        lower(concat_ws(' ',
          s.title,
          (select string_agg(name, ' ' order by name)
           from (
             select p.name
             from public.song_composers sc join public.people p on p.id = sc.person_id
             where sc.song_id = s.id
             union
             select p.name
             from public.song_lyricists sl join public.people p on p.id = sl.person_id
             where sl.song_id = s.id
           ) credits),
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
  where
    exists (select 1 from public.song_composers sc where sc.song_id = s.id)
    or exists (select 1 from public.song_lyricists sl where sl.song_id = s.id)
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
