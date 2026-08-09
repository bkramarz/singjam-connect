-- Migration 156: make official-event hosting a capability, not a role
--
-- 155 added an 'event_host' value to the user_role enum, following the
-- convention from 102. That was the wrong shape here: `role` is a single enum
-- column, so it is mutually exclusive — designating one of the 11 song_editors
-- an event host would have silently stripped their song-editing rights.
--
-- Hosting official events is a capability that should compose with a role, not
-- replace it. Someone can now be a song_editor, an official-event host, both,
-- or neither. Admins keep it implicitly.
--
-- The 'event_host' enum label stays present but INERT. Postgres cannot drop a
-- value from an enum in place; removing it means recreating the type, which
-- means dropping and recreating every RLS policy that compares against it
-- (102 has several). That is real risk for no functional gain on a label nobody
-- holds. Nothing reads it after this migration — grant the capability below.

alter table public.profiles
  add column if not exists can_host_official boolean not null default false;

-- Defensive: nobody currently holds 'event_host', but don't silently revoke it
-- if that changed between 155 and this migration.
update public.profiles
   set can_host_official = true
 where role::text = 'event_host';

-- Anyone left on the inert label falls back to plain member.
update public.profiles
   set role = 'member'
 where role::text = 'event_host';

comment on column public.profiles.can_host_official is
  'Can publish official (public, ticket-selling) events. Composes with role — admins have it implicitly.';

-- Same trigger as 155, now reading the capability instead of the enum label.
create or replace function public.enforce_official_jam_authz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only gate the transition INTO official. Editing an already-official event,
  -- or any non-official event, is unaffected.
  if new.visibility = 'official'
     and (tg_op = 'INSERT' or old.visibility is distinct from 'official') then

    -- No JWT means service_role: our own server routes, migrations and seeds.
    -- An anonymous browser cannot reach here — the insert policies already
    -- require auth.uid() = host_user_id.
    if auth.uid() is null then
      return new;
    end if;

    if not exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (role::text = 'admin' or can_host_official)
    ) then
      raise exception 'Only admins and designated event hosts can publish official events'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
