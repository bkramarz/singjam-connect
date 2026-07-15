-- Migration 141: jam co-hosts
-- Lets a jam host promote attendees to co-host, sharing invite/message/set-list
-- management duties without granting edit/cancel/co-host-management rights.

create table public.jam_cohosts (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(jam_id, user_id)
);

create index jam_cohosts_jam_id_idx on public.jam_cohosts (jam_id);

alter table public.jam_cohosts enable row level security;

grant select on public.jam_cohosts to anon;
grant select, insert, update, delete on public.jam_cohosts to authenticated;
grant select, insert, update, delete on public.jam_cohosts to service_role;

-- Mirrors the "attending count readable" policy on jam_rsvps (058_jam_rsvps.sql):
-- co-host status is non-sensitive "who's helping run this" info shown in the attendee list.
create policy "cohosts readable"
  on public.jam_cohosts for select
  using (true);

-- Only the true host can promote/demote co-hosts.
create policy "host manages cohosts insert"
  on public.jam_cohosts for insert
  with check (
    exists (select 1 from public.jams j where j.id = jam_id and j.host_user_id = (select auth.uid()))
  );

create policy "host manages cohosts delete"
  on public.jam_cohosts for delete
  using (
    exists (select 1 from public.jams j where j.id = jam_id and j.host_user_id = (select auth.uid()))
  );
