alter table public.songs
  add column if not exists vibe text check (vibe in ('Banger', 'Ballad'));
