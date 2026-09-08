-- Migration 161: find paid ticket orders whose buyer was never seated
--
-- fulfilPendingOrder flips the order to 'paid' and only THEN calls
-- markAttending. The `.eq('status','pending')` guard that makes Stripe's
-- redeliveries safe also means everything after it gets exactly one attempt:
-- once the order says paid, a retry can never re-enter that block. Worse,
-- markAttending never checks the error on its writes, so a failed insert
-- neither throws nor leaves a trace — the webhook returns 200 and the buyer is
-- simply not there. Money taken, ticket delivered, nobody on the guest list.
--
-- The confirmation email survives this because it has its own per-order marker
-- (ticket_email_sent_at, migration 154) that a retry re-reads. Attendance has
-- no marker, so the queue is derived instead: a paid order by a member with no
-- jam_rsvps row at all.
--
-- Deliberately "no row", NOT "no attending row". Cancelling an RSVP sets
-- status='cancelled' and leaves the row behind, and the cancel handler has no
-- official-event guard — so a ticket holder can drop out on purpose. Keying on
-- the status would re-seat them every ten minutes against their wishes. The
-- complete absence of a row can only mean fulfilment never finished.
--
-- Refunded orders fall out on their own: a full refund moves the order to
-- 'refunded', which this does not select.

create or replace function public.ticket_orders_awaiting_attendance(
  newer_than_days int default 30
)
returns table (order_id uuid, jam_id uuid, user_id uuid)
language sql
security definer
set search_path = public
as $$
  select o.id, o.jam_id, o.buyer_user_id
  from public.ticket_orders o
  where o.status = 'paid'
    and o.buyer_user_id is not null
    and o.paid_at > now() - make_interval(days => newer_than_days)
    -- Guests are not eligible: jam_rsvps.user_id is NOT NULL and references
    -- profiles, so a guest order has nothing to attach attendance to. They
    -- appear on the guest list through the guest-attendees route instead.
    and not exists (
      select 1 from public.jam_rsvps r
      where r.jam_id = o.jam_id
        and r.user_id = o.buyer_user_id
    )
  -- A unique tiebreaker so repeat sweeps see a stable order.
  order by o.paid_at, o.id
  limit 100;
$$;

-- Server-only, like the orders themselves: the scheduled sweep calls this with
-- the service_role key and nothing else should reach it.
revoke all on function public.ticket_orders_awaiting_attendance(int) from public, anon, authenticated;
grant execute on function public.ticket_orders_awaiting_attendance(int) to service_role;
