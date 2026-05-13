-- Extend status to include 'requested' for access request flow
alter table public.set_collaborators
  drop constraint if exists set_collaborators_status_check;

alter table public.set_collaborators
  add constraint set_collaborators_status_check
  check (status in ('pending', 'accepted', 'requested'));

-- Prevent a user from submitting duplicate access requests for the same set
create unique index set_collaborators_request_unique
  on public.set_collaborators (set_id, user_id)
  where status = 'requested' and user_id is not null;
