-- Migration 054: add public jam support
-- Add name and tickets_url fields, extend visibility to include 'public'

alter table public.jams add column if not exists name text;
alter table public.jams add column if not exists tickets_url text;

-- Widen the visibility constraint to include 'public'
alter table public.jams drop constraint if exists jams_visibility_check;
alter table public.jams add constraint jams_visibility_check
  check (visibility in ('private', 'radius', 'public'));

-- Allow anyone (including unauthenticated) to read public jams
create policy "public jams are publicly readable"
  on public.jams for select
  using (visibility = 'public');
