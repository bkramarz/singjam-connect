-- Migration 067: feature flags table for admin-controlled feature toggles

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default true
);

-- Seed default flags
insert into public.feature_flags (key, enabled) values
  ('jam_invites', true)
on conflict (key) do nothing;

-- Anyone can read flags; only admins can update
alter table public.feature_flags enable row level security;

create policy "public read feature_flags" on public.feature_flags
  for select using (true);

create policy "admin write feature_flags" on public.feature_flags
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
