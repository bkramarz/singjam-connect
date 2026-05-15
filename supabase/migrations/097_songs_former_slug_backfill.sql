-- Add former_slug to preserve old URLs when slugs are corrected
alter table public.songs add column if not exists former_slug text;

create index if not exists songs_former_slug_idx on public.songs(former_slug);

grant select on public.songs to anon;
grant select, insert, update, delete on public.songs to authenticated;
grant select, insert, update, delete on public.songs to service_role;

-- Recalculate slugs for songs whose current slug omits composer/lyricist names.
-- Replicates the JS generateSlug logic: title + composers + lyricists, lowercased,
-- non-alphanumeric stripped, spaces collapsed to hyphens.
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
           where sl.song_id = s.id)
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
    former_slug = c.old_slug
from changed c
where s.id = c.id;
