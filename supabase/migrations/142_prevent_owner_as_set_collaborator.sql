-- Migration 142: a set's owner should never also have a set_collaborators row.
-- Defense-in-depth after two bugs in the jam co-host / set-linking work where
-- application code failed to exclude the owner from an auto-add-collaborators
-- step. This only blocks a row where user_id matches that specific set's
-- owner_user_id — it has no effect on editor/viewer collaborators who aren't
-- the owner, and no effect on role or status values.

create or replace function public.prevent_owner_as_set_collaborator()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null and exists (
    select 1 from public.sets s
    where s.id = new.set_id and s.owner_user_id = new.user_id
  ) then
    raise exception 'A set''s owner cannot also be a collaborator on that set';
  end if;
  return new;
end;
$$;

create trigger set_collaborators_no_owner
  before insert or update on public.set_collaborators
  for each row
  execute function public.prevent_owner_as_set_collaborator();
