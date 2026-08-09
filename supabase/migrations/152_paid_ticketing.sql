-- Migration 152: paid ticketing (Stripe)
--
-- Single-account model: all funds go to the org, so there is no Connect
-- connected-account state here. Tiered pricing: a jam has N ticket_types.
--
-- Money-touching tables (ticket_orders, tickets) follow the email_outbox
-- precedent from migration 149 rather than the standard client-facing template:
-- they are written and read exclusively by server routes via the service_role
-- key, so anon/authenticated get no grants at all and RLS is enabled with no
-- policies as defense in depth. Buyers reach their own tickets through an API
-- route that authorizes with the admin client — the pattern already used for
-- set-list permissions.

-- ---------------------------------------------------------------------------
-- Ticket types (tiers)
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  -- null = no per-tier cap. Venue capacity is tracked separately on jams.capacity.
  quantity integer check (quantity is null or quantity > 0),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ticket_types_sales_window check (
    sales_start_at is null or sales_end_at is null or sales_end_at > sales_start_at
  )
);

create index if not exists ticket_types_jam_idx on public.ticket_types (jam_id, sort_order, id);

alter table public.ticket_types enable row level security;

-- Tiers are readable by anyone who can read the jam. The subquery is itself
-- subject to the jams "read jams" policy (migration 063), so tier visibility
-- inherits jam visibility automatically instead of duplicating the rules.
-- Dropped first so this migration is re-runnable: create policy has no
-- IF NOT EXISTS, and a partial failure downstream would otherwise wedge a retry.
drop policy if exists "read ticket types via jam" on public.ticket_types;
create policy "read ticket types via jam" on public.ticket_types
  for select using (
    exists (select 1 from public.jams j where j.id = ticket_types.jam_id)
  );

grant select on public.ticket_types to anon;
grant select on public.ticket_types to authenticated;
grant select, insert, update, delete on public.ticket_types to service_role;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_orders (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  -- Nullable because inventory is reserved BEFORE the Stripe session exists
  -- (reserving after would let us sell a session for sold-out stock). Unique
  -- still holds — Postgres permits many NULLs — and it is the idempotency key
  -- that makes webhook redelivery safe.
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  -- Inventory hold expiry. A pending order stops counting against stock once
  -- this passes, which is what stops an abandoned checkout blocking a sellout.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists ticket_orders_jam_status_idx on public.ticket_orders (jam_id, status);
create index if not exists ticket_orders_buyer_idx on public.ticket_orders (buyer_user_id, created_at desc);
-- The expiry sweeper scans live holds oldest-first.
create index if not exists ticket_orders_pending_idx
  on public.ticket_orders (expires_at)
  where status = 'pending';

alter table public.ticket_orders enable row level security;
grant select, insert, update, delete on public.ticket_orders to service_role;

-- ---------------------------------------------------------------------------
-- Tickets (one row per ticket — these ARE the order line items)
-- ---------------------------------------------------------------------------

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticket_orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  jam_id uuid not null references public.jams(id) on delete cascade,
  holder_user_id uuid references public.profiles(id) on delete set null,
  holder_name text,
  -- Door check-in credential. Random and separate from the id, so possessing a
  -- ticket id does not let you forge a scannable code. A v4 uuid carries 122
  -- bits of randomness, and matches how jam_invites (060) and sets (079)
  -- already mint tokens. Avoids gen_random_bytes, which needs pgcrypto on the
  -- search_path — it lives in Supabase's `extensions` schema, so it is not
  -- resolvable from a migration even though 001 created the extension.
  qr_token uuid not null unique default gen_random_uuid(),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tickets_order_idx on public.tickets (order_id);
create index if not exists tickets_type_idx on public.tickets (ticket_type_id);
create index if not exists tickets_jam_idx on public.tickets (jam_id);
create index if not exists tickets_holder_idx on public.tickets (holder_user_id);

alter table public.tickets enable row level security;
grant select, insert, update, delete on public.tickets to service_role;

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------

-- Tickets count against stock when their order is paid, or pending-and-unexpired.
create or replace function public.ticket_type_sold_count(type_id uuid)
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
    and (
      o.status = 'paid'
      or (o.status = 'pending' and o.expires_at > now())
    );
$$;

grant execute on function public.ticket_type_sold_count(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Atomic reservation
-- ---------------------------------------------------------------------------

-- Reserves stock and creates a pending order + its tickets in one transaction.
--
-- The `for update` lock over the jam's ticket_types serializes concurrent
-- buyers for that jam. Without it, two buyers can both read "1 left", both
-- pass the check, and both pay — the classic oversell. Checking capacity in
-- application code cannot fix this; the check and the insert must share a
-- transaction and a lock.
--
-- items: [{"ticket_type_id": "<uuid>", "quantity": 2}, ...]
-- Returns the new order id. Raises on sold-out, bad tier, or closed sales.
create or replace function public.reserve_ticket_order(
  jam_id_param uuid,
  buyer_param uuid,
  items jsonb,
  hold_minutes integer default 15
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_type public.ticket_types;
  v_qty integer;
  v_available integer;
  v_total integer := 0;
  v_currency text;
begin
  if buyer_param is null then
    raise exception 'buyer required';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'no ticket items supplied';
  end if;

  -- Serialize concurrent reservations for this jam.
  perform 1
  from public.ticket_types
  where jam_id = jam_id_param
  order by id
  for update;

  for v_item in select * from jsonb_array_elements(items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    if v_qty <= 0 then
      raise exception 'quantity must be positive';
    end if;

    select * into v_type
    from public.ticket_types
    where id = (v_item ->> 'ticket_type_id')::uuid
      and jam_id = jam_id_param;

    if v_type.id is null then
      raise exception 'ticket type % not found for this jam', v_item ->> 'ticket_type_id';
    end if;

    if v_type.sales_start_at is not null and now() < v_type.sales_start_at then
      raise exception 'sales for % have not opened', v_type.name;
    end if;
    if v_type.sales_end_at is not null and now() > v_type.sales_end_at then
      raise exception 'sales for % have closed', v_type.name;
    end if;

    if v_currency is null then
      v_currency := v_type.currency;
    elsif v_currency <> v_type.currency then
      raise exception 'mixed currencies in one order';
    end if;

    if v_type.quantity is not null then
      v_available := v_type.quantity - public.ticket_type_sold_count(v_type.id);
      if v_available < v_qty then
        raise exception 'only % left of %', greatest(v_available, 0), v_type.name;
      end if;
    end if;

    v_total := v_total + (v_type.price_cents * v_qty);

    if v_order_id is null then
      insert into public.ticket_orders
        (jam_id, buyer_user_id, amount_cents, currency, expires_at)
      values
        (jam_id_param, buyer_param, 0, v_currency,
         now() + make_interval(mins => greatest(hold_minutes, 1)))
      returning id into v_order_id;
    end if;

    insert into public.tickets (order_id, ticket_type_id, jam_id, holder_user_id)
    select v_order_id, v_type.id, jam_id_param, buyer_param
    from generate_series(1, v_qty);
  end loop;

  update public.ticket_orders
     set amount_cents = v_total,
         currency = v_currency,
         updated_at = now()
   where id = v_order_id;

  return v_order_id;
end;
$$;

-- Server-only: the web API calls this with the service_role key after it has
-- authorized the buyer. Not exposed to anon/authenticated.
revoke all on function public.reserve_ticket_order(uuid, uuid, jsonb, integer) from public;
grant execute on function public.reserve_ticket_order(uuid, uuid, jsonb, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Hold expiry
-- ---------------------------------------------------------------------------

-- Marks elapsed holds expired so their tickets stop counting against stock.
-- ticket_type_sold_count already ignores elapsed pending orders, so this is
-- bookkeeping for reporting, not correctness.
create or replace function public.expire_stale_ticket_orders()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.ticket_orders
       set status = 'expired', updated_at = now()
     where status = 'pending'
       and expires_at <= now()
    returning 1
  )
  select count(*)::int from expired;
$$;

revoke all on function public.expire_stale_ticket_orders() from public;
grant execute on function public.expire_stale_ticket_orders() to service_role;
