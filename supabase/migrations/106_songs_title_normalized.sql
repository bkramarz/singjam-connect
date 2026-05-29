-- Generated column for punctuation-stripped title comparison.
-- Enables duplicate detection that catches "Johnny B Goode" vs "Johnny B. Goode" etc.
alter table public.songs
  add column title_normalized text generated always as (
    regexp_replace(lower(trim(title)), '[^a-z0-9 ]', '', 'g')
  ) stored;

create index songs_title_normalized_idx on public.songs (title_normalized);
