-- Migration 153: allow guest ticket checkout (no SingJam account required)
--
-- Buying a ticket should not require signing up. Most people arriving from a
-- shared event link have no account and will not make one to buy a ticket.
--
-- An order is therefore owned by EITHER a profile (member) or an email address
-- (guest), never neither. Members keep their profile link so tickets still show
-- up in-app and still create attendance rows; guests are identified by email.

alter table public.ticket_orders
  alter column buyer_user_id drop not null;

alter table public.ticket_orders
  add column if not exists buyer_email text,
  add column if not exists buyer_name text;

-- Exactly the invariant the application depends on: an order is always
-- attributable to someone. Without this a bug could produce an unreachable
-- order — money taken with no way to contact the buyer.
alter table public.ticket_orders
  drop constraint if exists ticket_orders_has_buyer;
alter table public.ticket_orders
  add constraint ticket_orders_has_buyer
  check (buyer_user_id is not null or buyer_email is not null);

create index if not exists ticket_orders_buyer_email_idx
  on public.ticket_orders (lower(buyer_email))
  where buyer_email is not null;

-- Guests have no profile, so the ticket holder may be a bare name.
alter table public.tickets
  add column if not exists holder_email text;

-- ---------------------------------------------------------------------------
-- Reservation, now guest-aware
-- ---------------------------------------------------------------------------

-- The previous signature took a non-null buyer uuid. Drop it explicitly rather
-- than letting a new signature sit alongside as an overload, which would make
-- which-one-runs depend on argument types at call time.
drop function if exists public.reserve_ticket_order(uuid, uuid, jsonb, integer);

create or replace function public.reserve_ticket_order(
  jam_id_param uuid,
  buyer_param uuid,
  items jsonb,
  hold_minutes integer default 35,
  buyer_email_param text default null,
  buyer_name_param text default null
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
  if buyer_param is null and (buyer_email_param is null or btrim(buyer_email_param) = '') then
    raise exception 'a buyer account or email is required';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'no ticket items supplied';
  end if;

  -- Serialize concurrent reservations for this jam. Without this lock two
  -- buyers can both read "1 left", both pass the check, and both pay.
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
        (jam_id, buyer_user_id, buyer_email, buyer_name, amount_cents, currency, expires_at)
      values
        (jam_id_param, buyer_param, nullif(btrim(coalesce(buyer_email_param, '')), ''),
         nullif(btrim(coalesce(buyer_name_param, '')), ''), 0, v_currency,
         now() + make_interval(mins => greatest(hold_minutes, 1)))
      returning id into v_order_id;
    end if;

    insert into public.tickets (order_id, ticket_type_id, jam_id, holder_user_id, holder_name, holder_email)
    select v_order_id, v_type.id, jam_id_param, buyer_param,
           nullif(btrim(coalesce(buyer_name_param, '')), ''),
           nullif(btrim(coalesce(buyer_email_param, '')), '')
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

revoke all on function public.reserve_ticket_order(uuid, uuid, jsonb, integer, text, text) from public;
grant execute on function public.reserve_ticket_order(uuid, uuid, jsonb, integer, text, text) to service_role;
