-- Add a 'co-owner' role to set_collaborators. Co-owners have every owner ability
-- (change visibility, edit songs/leaders, rename, manage collaborators, playlists)
-- except deleting the set or assigning/removing other co-owners — those stay
-- owner-only. Authorization for these actions is enforced in the API routes
-- (which mutate via the service-role client), so no RLS policy changes are needed;
-- this migration only widens the role check constraint so 'co-owner' rows are valid.
alter table public.set_collaborators
  drop constraint set_collaborators_role_check;

alter table public.set_collaborators
  add constraint set_collaborators_role_check check (role in ('editor', 'viewer', 'co-owner'));
