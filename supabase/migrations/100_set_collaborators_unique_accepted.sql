-- Prevent a user from having more than one accepted collaborator row on the same set.
-- The application-level check in the invite claim route is the first line of defence;
-- this index is the backstop that makes duplicates impossible at the DB level.
create unique index set_collaborators_accepted_unique
  on public.set_collaborators (set_id, user_id)
  where user_id is not null and status = 'accepted';
