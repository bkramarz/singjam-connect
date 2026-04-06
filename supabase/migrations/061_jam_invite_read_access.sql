-- Migration 061: allow invited users to read private jams
-- Previously private jams were only readable by the host.
-- Invitees (pending or accepted) must also be able to view the jam page.

drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'official'
    or (auth.uid() is not null and visibility = 'community')
    or auth.uid() = host_user_id
    or exists (
      select 1 from public.jam_invites i
      where i.jam_id = id
        and i.invited_user_id = auth.uid()
    )
  );
