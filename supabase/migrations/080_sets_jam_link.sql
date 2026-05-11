-- Link sets to jams: one set per jam

alter table public.sets
  add column jam_id uuid references public.jams(id) on delete set null;

create unique index sets_jam_id_unique on public.sets (jam_id) where jam_id is not null;
create index sets_jam_id_idx on public.sets (jam_id);
