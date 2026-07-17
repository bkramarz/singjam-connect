-- Migration 144: close a privilege-escalation gap on set_collaborators.
--
-- Since 079, "set_collaborators_insert" only checked `auth.uid() = invited_by` —
-- no restriction on set_id, role, or status. Combined with the blanket grants from
-- 091 and the `role` column defaulting to 'editor' (088), any authenticated user
-- could bypass the app entirely and INSERT a row making themselves an accepted
-- editor on ANY set, including private ones, via a direct PostgREST call. The
-- app-level owner/editor checks in the invite API routes never protected against
-- this because they only govern the Next.js routes, not direct table access.
--
-- 103's "set_collaborators_self_join" policy is correctly scoped (viewer-only,
-- link-mode-only), but permissive policies are OR'd, so the broad 079 policy made
-- it moot. This tightens the general insert policy to require the inviter to
-- already be the set's owner or an accepted editor collaborator — mirroring the
-- exact check in /api/sets/[id]/invite/route.ts.

drop policy "set_collaborators_insert" on public.set_collaborators;

create policy "set_collaborators_insert" on public.set_collaborators for insert
  with check (
    (select auth.uid()) = invited_by
    and (
      exists (
        select 1 from public.sets s
        where s.id = set_collaborators.set_id
          and s.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.set_collaborators sc
        where sc.set_id = set_collaborators.set_id
          and sc.user_id = (select auth.uid())
          and sc.status = 'accepted'
          and sc.role = 'editor'
      )
    )
  );
