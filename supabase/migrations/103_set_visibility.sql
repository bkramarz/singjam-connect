-- Extend set visibility from 2 modes to 3:
--   private  (was 'disabled') — invite only, non-collaborators see the request-access screen
--   link                      — open join; logged-in users who visit are auto-added as viewers
--   public   (was 'view')     — anyone with the URL can view without signing in, not added as collaborator

alter table public.sets
  drop constraint if exists sets_link_sharing_check;

update public.sets set link_sharing = 'private' where link_sharing = 'disabled';
update public.sets set link_sharing = 'public'  where link_sharing = 'view';

alter table public.sets
  add constraint sets_link_sharing_check
  check (link_sharing in ('private', 'link', 'public'));

-- Allow authenticated users to self-join a set that has open-join link sharing.
-- The check enforces: you can only insert yourself, only as an accepted viewer,
-- and only when the target set is in 'link' mode.
create policy "set_collaborators_self_join" on public.set_collaborators for insert
  with check (
    auth.uid() is not null
    and auth.uid() = user_id
    and status = 'accepted'
    and role = 'viewer'
    and exists (
      select 1 from public.sets s
      where s.id = set_id and s.link_sharing = 'link'
    )
  );
