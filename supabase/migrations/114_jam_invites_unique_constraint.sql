-- Remove any duplicate member invites, keeping the most recent per (jam_id, invited_user_id)
delete from public.jam_invites
where id not in (
  select distinct on (jam_id, invited_user_id) id
  from public.jam_invites
  where invited_user_id is not null
  order by jam_id, invited_user_id, created_at desc
)
and invited_user_id is not null;

-- Remove any duplicate email invites, keeping the most recent per (jam_id, invitee_email)
delete from public.jam_invites
where id not in (
  select distinct on (jam_id, invitee_email) id
  from public.jam_invites
  where invitee_email is not null
  order by jam_id, invitee_email, created_at desc
)
and invitee_email is not null;

-- Enforce uniqueness at the database level
create unique index if not exists jam_invites_jam_user_idx
  on public.jam_invites (jam_id, invited_user_id)
  where invited_user_id is not null;

create unique index if not exists jam_invites_jam_email_idx
  on public.jam_invites (jam_id, invitee_email)
  where invitee_email is not null;
