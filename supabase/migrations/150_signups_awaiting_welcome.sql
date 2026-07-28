-- Recent signups that haven't had their one lifecycle email yet.
--
-- The welcome email is now sent when the profile is saved, so it can greet the
-- user by the name they actually chose rather than a system-generated handle.
-- That leaves two gaps this backstops: users who never finish setup at all, and
-- users whose save fired but whose (fire-and-forget) send never landed. The
-- caller picks the variant — welcome if a name exists, "finish setting up" if
-- not — so both gaps are covered by one sweep.
--
-- Rows already in email_outbox are excluded, so a user gets at most one
-- lifecycle email and repeated sweeps are no-ops. auth.users is not reachable
-- over the Data API, hence the security-definer function.

drop function if exists public.incomplete_signups(int);
drop function if exists public.incomplete_signups(int, int);

-- The window is bounded at both ends on purpose: wait a day so we don't chase
-- someone mid-signup, and stop after a week so this never cold-emails accounts
-- that were abandoned long before the nudge existed.
create or replace function public.signups_awaiting_welcome(
  older_than_hours int default 24,
  newer_than_days int default 7
)
returns table (user_id uuid, email text, name text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text, coalesce(p.display_name, p.username)
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email is not null
    and u.created_at < now() - make_interval(hours => older_than_hours)
    and u.created_at > now() - make_interval(days => newer_than_days)
    -- "No outbox row" only means "not emailed yet" for users who signed up
    -- after the outbox started recording. Before that we have no record either
    -- way, so anyone older is left alone rather than risk a second welcome.
    -- Empty outbox → now() → nobody qualifies, which fails safe.
    and u.created_at > coalesce((select min(created_at) from public.email_outbox), now())
    and not exists (
      select 1 from public.email_outbox o
      where o.user_id = u.id and o.type = 'welcome'
    )
  order by u.created_at
  limit 200;
$$;

-- Server-only, like email_outbox itself: the scheduled flush function calls
-- this with the service_role key and nothing else should reach it.
revoke all on function public.signups_awaiting_welcome(int, int) from public, anon, authenticated;
grant execute on function public.signups_awaiting_welcome(int, int) to service_role;
