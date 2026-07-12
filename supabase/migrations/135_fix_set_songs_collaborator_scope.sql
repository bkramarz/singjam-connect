-- Fix scope bug in set_songs write policies.
--
-- Since 079 (carried through 088), the collaborator branch used
-- `sc.set_id = set_id` inside a subquery on set_collaborators sc. The
-- unqualified `set_id` binds to the INNER scope (sc.set_id), making the
-- comparison a tautology: any accepted editor collaborator on ANY set
-- passed the check for EVERY set's songs. Qualify the outer column so the
-- check is scoped to the set actually being modified.

alter policy "set_songs_insert" on public.set_songs
  with check (
    (select auth.uid()) is not null
    and (
      exists (select 1 from public.sets s where s.id = set_songs.set_id and s.owner_user_id = (select auth.uid()))
      or exists (
        select 1 from public.set_collaborators sc
        where sc.set_id = set_songs.set_id
          and sc.user_id = (select auth.uid())
          and sc.status = 'accepted'
          and sc.role = 'editor'
      )
    )
  );

alter policy "set_songs_update" on public.set_songs
  using (
    exists (select 1 from public.sets s where s.id = set_songs.set_id and s.owner_user_id = (select auth.uid()))
    or exists (
      select 1 from public.set_collaborators sc
      where sc.set_id = set_songs.set_id
        and sc.user_id = (select auth.uid())
        and sc.status = 'accepted'
        and sc.role = 'editor'
    )
  );

alter policy "set_songs_delete" on public.set_songs
  using (
    exists (select 1 from public.sets s where s.id = set_songs.set_id and s.owner_user_id = (select auth.uid()))
    or exists (
      select 1 from public.set_collaborators sc
      where sc.set_id = set_songs.set_id
        and sc.user_id = (select auth.uid())
        and sc.status = 'accepted'
        and sc.role = 'editor'
    )
  );
