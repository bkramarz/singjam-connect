-- Migration 143: let jam co-hosts read jam_invites
-- App code (isHost || isCoHost in app/jam/[id]/page.tsx, added in 141_jam_cohosts.sql)
-- already gates invite-list visibility on co-host status, but these RLS policies
-- were never updated to match — co-hosts got an empty/short result set since only
-- host_user_id was checked.

alter policy "host and attendees read jam_invites" on public.jam_invites
  using (
    (select auth.uid()) = invited_user_id
    or exists (
      select 1 from public.jams j
      where j.id = jam_invites.jam_id and j.host_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.jam_cohosts c
      where c.jam_id = jam_invites.jam_id and c.user_id = (select auth.uid())
    )
  );

alter policy "hosts can read jam invites" on public.jam_invites
  using (
    exists (
      select 1 from public.jams j
      where j.id = jam_invites.jam_id and j.host_user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.jam_cohosts c
      where c.jam_id = jam_invites.jam_id and c.user_id = (select auth.uid())
    )
  );
