-- Migration 073: expire read notifications after 30 days

-- Index to make the per-user cleanup query fast
create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read, created_at);

-- One-time backfill: remove any read notifications already older than 30 days
delete from public.notifications
where read = true
  and created_at < now() - interval '30 days';
