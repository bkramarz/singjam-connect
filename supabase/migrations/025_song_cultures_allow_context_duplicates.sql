-- Migration 025: allow the same culture to appear with different contexts
-- (e.g. Traditional Irish music + Traditional Irish lyrics stored as separate rows)
-- The old primary key (song_id, culture_id) blocks this, so we replace it with
-- a surrogate key and two partial unique indexes.

alter table public.song_cultures drop constraint song_cultures_pkey;

alter table public.song_cultures
  add column id uuid default gen_random_uuid();

update public.song_cultures set id = gen_random_uuid() where id is null;

alter table public.song_cultures
  alter column id set not null;

alter table public.song_cultures
  add primary key (id);

-- One non-contextual row per (song, culture)
create unique index song_cultures_no_context_unique
  on public.song_cultures (song_id, culture_id)
  where context is null;

-- One contextual row per (song, culture, context)
create unique index song_cultures_with_context_unique
  on public.song_cultures (song_id, culture_id, context)
  where context is not null;
