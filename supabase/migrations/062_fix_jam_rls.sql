-- Migration 062: fix two issues with jams read RLS
--
-- 1. Drop the catch-all "public read jams" (qual=true) policy that was making
--    ALL jams world-readable, including private ones. This was an early-dev
--    leftover that should have been removed in migration 057.
--
-- 2. Fix the "read jams" policy's invitee subquery. In migration 061 the
--    unqualified `id` inside the subquery was resolved as jam_invites.id
--    (since jam_invites gained an id column in migration 060), making the
--    condition `i.jam_id = i.id` — always false. Use jams.id explicitly.

drop policy if exists "public read jams" on public.jams;
drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'official'
    or (auth.uid() is not null and visibility = 'community')
    or auth.uid() = host_user_id
    or exists (
      select 1 from public.jam_invites i
      where i.jam_id = jams.id
        and i.invited_user_id = auth.uid()
    )
  );
