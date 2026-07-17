-- Migration 145: fix infinite recursion in 144's set_collaborators_insert policy.
--
-- 144's WITH CHECK subqueried set_collaborators from within a policy ON
-- set_collaborators itself ("is the caller an accepted editor on this set?").
-- Postgres has to apply the table's own SELECT policy to that inner subquery,
-- which re-triggers evaluation of the same relation's RLS — Postgres detects
-- the cycle and raises "infinite recursion detected in policy for relation
-- set_collaborators" rather than looping forever.
--
-- Fix: move the self-referential check into a SECURITY DEFINER function. Its
-- internal query runs as the function owner (bypassing RLS on the read), so
-- the policy no longer re-enters set_collaborators' own RLS.

create or replace function public.is_accepted_set_editor(p_set_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.set_collaborators sc
    where sc.set_id = p_set_id
      and sc.user_id = p_user_id
      and sc.status = 'accepted'
      and sc.role = 'editor'
  );
$$;

grant execute on function public.is_accepted_set_editor(uuid, uuid) to authenticated;

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
      or public.is_accepted_set_editor(set_collaborators.set_id, (select auth.uid()))
    )
  );
