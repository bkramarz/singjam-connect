-- Migration 159: scope promotion codes to an event
--
-- Stripe promotion codes are account-wide, and we run a single Stripe account.
-- Both lookup paths resolved a code with promotionCodes.list({code}) and never
-- referenced the jam, so ANY active code worked on ANY event's checkout — one
-- host's discount was redeemable by another host's buyers. Harmless while Ben is
-- the only host; wrong as soon as can_host_official (156) is granted to anyone.
--
-- This table owns the event association. Stripe still holds the coupon and does
-- the discount arithmetic — it stays authoritative for what is actually charged —
-- but a code is only honoured on the jam it was created for.

create table if not exists public.ticket_promo_codes (
  id uuid primary key default gen_random_uuid(),
  jam_id uuid not null references public.jams(id) on delete cascade,
  -- The literal code buyers type. Kept literal rather than namespaced so what a
  -- buyer enters is what appears in the Stripe Dashboard — collisions are
  -- rejected at creation instead.
  code text not null,
  stripe_promotion_code_id text not null,
  stripe_coupon_id text not null,
  -- Display copy ("25% off", "$5.00 off"), so listing codes needs no Stripe call.
  label text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Mirrors Stripe's own constraint: it refuses a second active promotion code with
-- the same code, so enforce that here too and fail fast with a clear message
-- rather than surfacing a Stripe error to a host.
create unique index if not exists ticket_promo_codes_code_key
  on public.ticket_promo_codes (lower(code));

create index if not exists ticket_promo_codes_jam_idx
  on public.ticket_promo_codes (jam_id, created_at desc);

alter table public.ticket_promo_codes enable row level security;

-- Server-only, like ticket_orders and tickets (149's precedent). Buyers validate
-- codes through the API with the admin client, which also stops the full code
-- list being readable by anyone who wants a free ticket.
grant select, insert, update, delete on public.ticket_promo_codes to service_role;
