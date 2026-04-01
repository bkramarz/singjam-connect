-- Migration 060: invite system overhaul + notifications

-- guests_can_invite on jams (for private jams)
alter table public.jams add column if not exists guests_can_invite boolean not null default false;

-- Replace composite PK (jam_id, invited_user_id) with a standalone id column
-- so that invited_user_id can be null (non-member / email-only invites)
alter table public.jam_invites drop constraint if exists jam_invites_pkey;
alter table public.jam_invites add column if not exists id uuid default gen_random_uuid();
-- Back-fill id for any existing rows that don't have one
update public.jam_invites set id = gen_random_uuid() where id is null;
alter table public.jam_invites alter column id set not null;
alter table public.jam_invites add primary key (id);

-- Extend jam_invites with invited_by and invitee_email (for non-members)
alter table public.jam_invites add column if not exists invited_by uuid references public.profiles(id) on delete set null;
alter table public.jam_invites add column if not exists invitee_email text;
alter table public.jam_invites add column if not exists token uuid not null default gen_random_uuid();

-- Allow null invited_user_id for non-member invites (email-only)
alter table public.jam_invites alter column invited_user_id drop not null;

-- Make token unique for lookup after signup
create unique index if not exists jam_invites_token_idx on public.jam_invites(token);

-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- RLS for jam_invites: invitee can read their own, host can read all for their jam
drop policy if exists "invitees can read their invites" on public.jam_invites;
drop policy if exists "hosts can read jam invites" on public.jam_invites;
drop policy if exists "invite rsvp read" on public.jam_invites;
drop policy if exists "invite rsvp insert host" on public.jam_invites;
drop policy if exists "invite rsvp update invited" on public.jam_invites;

create policy "invitees can read their invites"
  on public.jam_invites for select
  using (auth.uid() = invited_user_id);

create policy "hosts can read jam invites"
  on public.jam_invites for select
  using (
    exists (
      select 1 from public.jams j
      where j.id = jam_id and j.host_user_id = auth.uid()
    )
  );

create policy "authenticated users can insert invites"
  on public.jam_invites for insert
  to authenticated
  with check (auth.uid() = invited_by);

create policy "invitees can update their invites"
  on public.jam_invites for update
  using (auth.uid() = invited_user_id);
