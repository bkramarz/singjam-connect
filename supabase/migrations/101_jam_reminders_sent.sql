-- Migration 101: track sent jam reminder emails to prevent duplicates

create table if not exists public.jam_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('24h')),
  sent_at timestamptz default now(),
  unique(jam_id, reminder_type)
);

alter table public.jam_reminders_sent enable row level security;

grant select, insert on public.jam_reminders_sent to service_role;
