-- Migration 160: private jams become *unlisted* rather than access-controlled.
--
-- Product change: anyone holding a link to a private jam may view it and RSVP.
-- The only thing "private" now means is that the jam is never surfaced in a
-- listing to someone who isn't connected to it.
--
-- The jam *detail* page serves any jam by id through the service-role route
-- (app/api/jam/[id]/public), so this policy deliberately does NOT make private
-- jams world-readable: keeping them out of RLS means a bulk `select * from jams`
-- with the public anon key still can't enumerate them. Unlisted stays unlisted;
-- the link is the key.
--
-- What changes here: attending a jam now grants read, so someone who RSVPs from
-- a link keeps seeing it in their own jam list afterwards. Previously only an
-- invite row did that, and RSVPing creates none — so a link guest would RSVP,
-- land on the host's guest list, and then have the jam vanish from their app.

create or replace function public.user_attends_jam(jam_id_param uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.jam_rsvps
    where jam_id = jam_id_param
      and user_id = auth.uid()
      and status <> 'cancelled'
  );
$$;

-- SECURITY DEFINER for the same reason as user_has_jam_invite (migration 063):
-- jam_rsvps policies reference jams, so an inline subquery here would recurse.

drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'official'
    or visibility = 'community'
    or (select auth.uid()) = host_user_id
    or public.user_has_jam_invite(id)
    or public.user_attends_jam(id)
  );
