-- Transactional email outbox: durable, idempotent, retryable delivery for
-- lifecycle emails (currently the welcome email). Signup enqueues a row and
-- attempts an immediate send; a scheduled function retries anything still
-- pending. The unique (user_id, type) index guarantees at-most-once enqueue
-- across every signup entry point, so a transient failure is retried and a
-- retry never double-sends.

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  type text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

-- One email of a given type per user, ever: idempotent enqueue + no double-send.
create unique index if not exists email_outbox_user_type_key
  on public.email_outbox (user_id, type);

-- The retry sweeper scans pending rows oldest-first.
create index if not exists email_outbox_pending_idx
  on public.email_outbox (created_at)
  where status = 'pending';

alter table public.email_outbox enable row level security;

-- Server-only table. It is written and read exclusively by server routes and
-- the scheduled flush function via the service_role key, so — unlike the
-- standard client-facing table template — anon/authenticated are intentionally
-- granted no access (RLS is enabled with no policies as defense in depth).
grant select, insert, update, delete on public.email_outbox to service_role;
