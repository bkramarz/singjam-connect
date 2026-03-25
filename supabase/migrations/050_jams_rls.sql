-- Migration 050: enable RLS on jams and jam_invites

alter table public.jams enable row level security;
alter table public.jam_invites enable row level security;

-- ─── jams ────────────────────────────────────────────────────────────────────

-- Anyone (including anon) can browse jams
create policy "public read jams"
  on public.jams for select using (true);

-- Signed-in users can post a jam, but only with their own user id as host
create policy "authenticated insert jams"
  on public.jams for insert
  with check (auth.uid() = host_user_id);

-- Only the host can update or delete their jam
create policy "host update jams"
  on public.jams for update
  using (auth.uid() = host_user_id);

create policy "host delete jams"
  on public.jams for delete
  using (auth.uid() = host_user_id);


-- ─── jam_invites ─────────────────────────────────────────────────────────────

-- Host and attendees can see who's coming
create policy "host and attendees read jam_invites"
  on public.jam_invites for select
  using (
    auth.uid() = invited_user_id
    or exists (
      select 1 from public.jams
      where jams.id = jam_id and jams.host_user_id = auth.uid()
    )
  );

-- Signed-in users can RSVP to a jam (only with their own user id)
create policy "authenticated insert jam_invites"
  on public.jam_invites for insert
  with check (auth.uid() = invited_user_id);

-- Users can update their own RSVP status
create policy "own update jam_invites"
  on public.jam_invites for update
  using (auth.uid() = invited_user_id);

-- Users can withdraw their own RSVP
create policy "own delete jam_invites"
  on public.jam_invites for delete
  using (auth.uid() = invited_user_id);

-- ─── attendee count (public) ─────────────────────────────────────────────────
-- A separate security-definer function lets anyone see the headcount per jam
-- without exposing who specifically is attending.

create or replace function public.jam_attendee_counts()
returns table (jam_id uuid, attendee_count bigint)
language sql
security definer
as $$
  select jam_id, count(*) as attendee_count
  from public.jam_invites
  where status = 'accepted'
  group by jam_id;
$$;
