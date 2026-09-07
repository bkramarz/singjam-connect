-- Migration 158: separate "sold" from "held"
--
-- ticket_type_sold_count() counts tickets whose order is paid OR pending and
-- unexpired. That is exactly right for the oversell guard — a checkout in
-- progress must hold its stock or two buyers can both take the last seat — but
-- it is the wrong number to label "sold" on the host's page. An abandoned
-- checkout showed as a sale, so a host with nothing sold could see "4 sold".
--
-- This adds a paid-only count. The reservation guard keeps using
-- ticket_type_sold_count; the host UI shows paid and held separately, and
-- availability still subtracts both.

create or replace function public.ticket_type_paid_count(type_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.tickets t
  join public.ticket_orders o on o.id = t.order_id
  where t.ticket_type_id = type_id
    and o.status = 'paid';
$$;

grant execute on function public.ticket_type_paid_count(uuid) to anon, authenticated, service_role;

comment on function public.ticket_type_paid_count(uuid) is
  'Tickets actually paid for. Use ticket_type_sold_count() for availability — it also counts live holds.';
