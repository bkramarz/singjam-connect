alter table public.set_songs add column if not exists played boolean not null default false;
