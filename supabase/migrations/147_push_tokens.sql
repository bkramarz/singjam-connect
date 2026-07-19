-- Migration 147: push notification device tokens
-- Stores Expo push tokens for the native app. One row per device token;
-- a token is unique across users so a device that switches accounts is
-- reassigned to the new user on upsert.

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

grant select on public.push_tokens to anon;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert, update, delete on public.push_tokens to service_role;

create policy "users read own push tokens"
  on public.push_tokens for select
  using (user_id = (select auth.uid()));

create policy "users delete own push tokens"
  on public.push_tokens for delete
  using (user_id = (select auth.uid()));

-- Registration goes through this RPC rather than direct insert so that a
-- device switching accounts can reassign its token row: owner-scoped RLS
-- would block the new user from touching the previous user's row. The token
-- value itself is an unguessable device secret, so knowing it proves
-- possession of the device.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;
  insert into public.push_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
