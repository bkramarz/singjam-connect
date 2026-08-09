-- Migration 154: track ticket confirmation email delivery
--
-- A guest has no account, so this email is their only copy of the ticket —
-- losing it is worse than losing an RSVP confirmation.
--
-- Not routed through email_outbox (149): that table's unique (user_id, type)
-- index is at-most-once per user *ever*, and user_id is NULL for guests. Both
-- properties are wrong here — a buyer can order tickets to many events, and
-- guests have no user id at all. A per-order timestamp gives the one guarantee
-- that actually matters: Stripe redelivering a webhook must not re-send.

alter table public.ticket_orders
  add column if not exists ticket_email_sent_at timestamptz;

-- Lets a sweeper find paid orders whose confirmation never went out.
create index if not exists ticket_orders_email_pending_idx
  on public.ticket_orders (paid_at)
  where status = 'paid' and ticket_email_sent_at is null;
