-- Migration 055: rework jams — genres/themes, visibility levels, end time

-- Rename visibility values
update public.jams set visibility = 'official' where visibility = 'public';
update public.jams set visibility = 'community' where visibility = 'radius';

alter table public.jams drop constraint if exists jams_visibility_check;
alter table public.jams add constraint jams_visibility_check
  check (visibility in ('private', 'community', 'official'));

-- Change default from 'radius' to 'community'
alter table public.jams alter column visibility set default 'community';

-- Add end time
alter table public.jams add column if not exists ends_at timestamptz;

-- Drop jam_type (replaced by genres/themes)
alter table public.jams drop column if exists jam_type;

-- Junction tables
create table if not exists public.jam_genres (
  jam_id   uuid not null references public.jams(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (jam_id, genre_id)
);

create table if not exists public.jam_themes (
  jam_id   uuid not null references public.jams(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  primary key (jam_id, theme_id)
);

-- RLS
alter table public.jam_genres enable row level security;
alter table public.jam_themes enable row level security;

-- Anyone can read genres/themes for official jams
create policy "jam_genres readable for official jams"
  on public.jam_genres for select
  using (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.visibility = 'official'
    )
  );

create policy "jam_themes readable for official jams"
  on public.jam_themes for select
  using (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.visibility = 'official'
    )
  );

-- Logged-in users can read genres/themes for community jams
create policy "jam_genres readable for community jams"
  on public.jam_genres for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.visibility = 'community'
    )
  );

create policy "jam_themes readable for community jams"
  on public.jam_themes for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.visibility = 'community'
    )
  );

-- Hosts can insert genres/themes for their own jams
create policy "jam_genres insertable by host"
  on public.jam_genres for insert
  with check (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.host_user_id = auth.uid()
    )
  );

create policy "jam_themes insertable by host"
  on public.jam_themes for insert
  with check (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.host_user_id = auth.uid()
    )
  );

-- Hosts can delete genres/themes for their own jams
create policy "jam_genres deletable by host"
  on public.jam_genres for delete
  using (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.host_user_id = auth.uid()
    )
  );

create policy "jam_themes deletable by host"
  on public.jam_themes for delete
  using (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.host_user_id = auth.uid()
    )
  );

-- Update official jams public read policy
drop policy if exists "public jams are publicly readable" on public.jams;
create policy "official jams are publicly readable"
  on public.jams for select
  using (visibility = 'official');
