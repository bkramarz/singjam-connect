-- Migration 146: close a privacy/privilege-escalation gap on jam_invites.
--
-- Two permissive INSERT policies have existed since 060 (some altered outside
-- tracked migrations, confirmed live via direct query):
--
--   "authenticated insert jam_invites"      check (auth.uid() = invited_user_id)
--   "authenticated users can insert invites" check (auth.uid() = invited_by)
--
-- Neither restricts jam_id, so any authenticated user could:
--   1. Self-insert a jam_invites row for themselves on ANY jam (including
--      visibility = 'private'), which is enough to satisfy user_has_jam_invite()
--      (063_fix_jams_rls_recursion.sql) — a function that only checks EXISTENCE
--      of an invite row, not status — instantly bypassing the host's invite-only
--      privacy control for that jam.
--   2. Insert a fake invite row targeting any OTHER user for any jam, with no
--      host/cohost relationship required (same shape as the set_collaborators
--      bug fixed in 144/145).
--
-- Every real invite-creation path (/api/jam/[id]/invite, /api/jam/[id]/invite/link)
-- goes through supabaseAdmin (service role, bypasses RLS) with proper host/cohost/
-- attending-guest checks already enforced at the app layer. There is no legitimate
-- client-side insert path — joining a jam happens via jam_rsvps, a separate table —
-- so these policies are dropped outright rather than rewritten to mirror the app's
-- guest-invite logic in SQL.

drop policy if exists "authenticated insert jam_invites" on public.jam_invites;
drop policy if exists "authenticated users can insert invites" on public.jam_invites;
