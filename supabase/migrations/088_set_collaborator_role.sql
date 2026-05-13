-- Add role to set_collaborators (editor can mutate songs, viewer is read-only)
alter table public.set_collaborators
  add column role text not null default 'editor' check (role in ('editor', 'viewer'));

-- Allow set owners to update collaborator role
create policy "set_collaborators_update" on public.set_collaborators for update
  using (
    exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
  );

-- Restrict set_songs mutations to owners and editor collaborators only
drop policy "set_songs_insert" on public.set_songs;
drop policy "set_songs_update" on public.set_songs;
drop policy "set_songs_delete" on public.set_songs;

create policy "set_songs_insert" on public.set_songs for insert
  with check (
    auth.uid() is not null
    and (
      exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
      or exists (
        select 1 from public.set_collaborators sc
        where sc.set_id = set_id and sc.user_id = auth.uid()
          and sc.status = 'accepted' and sc.role = 'editor'
      )
    )
  );

create policy "set_songs_update" on public.set_songs for update
  using (
    exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
    or exists (
      select 1 from public.set_collaborators sc
      where sc.set_id = set_id and sc.user_id = auth.uid()
        and sc.status = 'accepted' and sc.role = 'editor'
    )
  );

create policy "set_songs_delete" on public.set_songs for delete
  using (
    exists (select 1 from public.sets s where s.id = set_id and s.owner_user_id = auth.uid())
    or exists (
      select 1 from public.set_collaborators sc
      where sc.set_id = set_id and sc.user_id = auth.uid()
        and sc.status = 'accepted' and sc.role = 'editor'
    )
  );
