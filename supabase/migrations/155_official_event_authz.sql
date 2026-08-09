-- Migration 155: restrict who can publish an 'official' event
--
-- The "Official SingJam event" option was hidden client-side only (an isAdmin
-- check in NewJamForm), while NewJamForm inserts straight to Supabase from the
-- browser and the jams INSERT policy only checked `auth.uid() = host_user_id`.
-- Any member could therefore publish an official event. Verified against the
-- live database with a real member session before writing this.
--
-- That was cosmetic before paid ticketing. It is not now: official events sell
-- tickets into the org's single Stripe account, so an unauthorized official
-- event means the org carries refunds, chargebacks and the tax position for a
-- sale it never agreed to.
--
-- Enforced with a TRIGGER rather than by patching the policies. RLS policies are
-- permissive and OR together: `jams` currently has TWO insert policies
-- ("insert own jam", "authenticated insert jams") and TWO update policies
-- ("update own jam", "host update jams"), so a row is admitted if ANY of them
-- passes. Patching all four would work today and silently regress the moment
-- someone adds a fifth. A trigger is an AND that no future policy can bypass.

-- Composes with the existing user_role enum (migration 102) rather than adding
-- a capability column, per the convention set there.
alter type public.user_role add value if not exists 'event_host';

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

    -- Compared as text on purpose: referencing the enum label added above in
    -- the same transaction would raise "unsafe use of new value of enum type".
    if not exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role::text in ('admin', 'event_host')
    ) then
      raise exception 'Only admins and designated event hosts can publish official events'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_official_jam_authz on public.jams;
create trigger enforce_official_jam_authz
  before insert or update on public.jams
  for each row
  execute function public.enforce_official_jam_authz();
