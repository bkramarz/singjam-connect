-- Migration 066: make community jams publicly readable
--
-- Community jams were only visible to authenticated users. Dropping that
-- restriction so anyone with a link can view jam details (date, location,
-- attendees). RSVP and invite actions still require login.

drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'official'
    or visibility = 'community'
    or auth.uid() = host_user_id
    or public.user_has_jam_invite(id)
  );
