-- Migration 063: fix infinite recursion in jams read policy
--
-- The jams read policy (062) checks jam_invites for invitee access.
-- The jam_invites "hosts can read jam invites" policy checks back into jams
-- to verify the host. This creates infinite recursion and Postgres errors on
-- every jams SELECT, making all jams invisible.
--
-- Fix: wrap the jam_invites lookup in a SECURITY DEFINER function. Running
-- with the function owner's privileges bypasses RLS on jam_invites for that
-- lookup, breaking the cycle. The function only exposes a boolean (does the
-- current user have an invite for this jam?), so nothing sensitive leaks.

create or replace function public.user_has_jam_invite(jam_id_param uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.jam_invites
    where jam_id = jam_id_param
      and invited_user_id = auth.uid()
  );
$$;

drop policy if exists "read jams" on public.jams;

create policy "read jams" on public.jams
  for select using (
    visibility = 'official'
    or (auth.uid() is not null and visibility = 'community')
    or auth.uid() = host_user_id
    or public.user_has_jam_invite(id)
  );
