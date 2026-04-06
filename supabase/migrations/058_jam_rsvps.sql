-- Migration 058: add capacity, full_address, and RSVP system

alter table public.jams add column if not exists full_address text;
alter table public.jams add column if not exists capacity integer;

-- RSVP table
create table if not exists public.jam_rsvps (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('attending', 'waitlist', 'cancelled')),
  waitlist_position integer,
  created_at timestamptz default now(),
  unique(jam_id, user_id)
);

alter table public.jam_rsvps enable row level security;

-- Users can read RSVPs for jams they have access to
create policy "users can read rsvps"
  on public.jam_rsvps for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.jams j
      where j.id = jam_id and j.host_user_id = auth.uid()
    )
  );

-- Users can count attending RSVPs (for capacity display) — read own jam's rsvps + public count
create policy "attending count readable"
  on public.jam_rsvps for select
  using (status = 'attending');

-- Users can insert their own RSVPs
create policy "users can rsvp"
  on public.jam_rsvps for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own RSVPs
create policy "users can update own rsvp"
  on public.jam_rsvps for update
  to authenticated
  using (auth.uid() = user_id);
