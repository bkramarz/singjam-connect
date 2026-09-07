# Ticketing test environment

Everything is running. Open the links below and click through.

## The port must be 3000

The Stripe return URL is built from `SITE_URL` in `apps/web/lib/stripe.ts`, which
reads `NEXT_PUBLIC_SITE_URL` — and `.env.local` sets that to `http://localhost:3000`.
Run the dev server on any other port and the payment still succeeds, the webhook
still fulfils, but Stripe bounces the buyer to port 3000 and they get
`ERR_CONNECTION_REFUSED` instead of their ticket. Nothing is broken when that
happens; the order is paid and the completion page is reachable by hand at
`/jam/<id>/tickets/complete?session_id=<cs_test_…>` on the right port.

## Verified end to end (2026-09-07)

A real guest purchase was completed in a real browser: card accepted,
`checkout.session.completed` and `payment_intent.succeeded` both delivered 200 to
the webhook, order moved to `paid`, stock decremented to 1/20, a ticket row was
issued, and the completion page rendered "You're going to …". The previously
suspect **Pay** button works.

This closes the one thing the earlier session could not prove: Stripe loads an
invisible hCaptcha that headless browsers routinely fail, so `confirm()` never
resolved for automation and returned no error to inspect. It needed a human.

## Links

| | |
|---|---|
| Event page (buyer) | http://localhost:3000/jam/a13e41a1-ef3f-437b-9b34-7ec1a6ff09fd |
| Tickets & guest list (host) | http://localhost:3000/jam/a13e41a1-ef3f-437b-9b34-7ec1a6ff09fd/tickets/manage |

## Accounts

| Persona | Email | Password |
|---|---|---|
| Event host | `benkramarz+singjam-test-host@gmail.com` | see below |
| Member | `benkramarz+singjam-test-member@gmail.com` | see below |
| Guest buyer | no account — use a private window | — |

Both are `+aliases` on your own address, so ticket emails land in your inbox.

These are real accounts on the production Supabase project, and this repo is
public, so the shared password lives in `apps/web/.env.local` (gitignored) as
`TICKETING_TEST_PASSWORD`. The seed script reads it from there and refuses to
run without it.

The host account is deliberately **not an admin**. It's a plain member with
`can_host_official = true`, so it exercises the capability added in migration 156.

## Test payment details

- Card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode
- Promo code **`SINGJAMTEST`** — 25% off
- Everything is Stripe **test mode**. No real money moves.

## Three passes worth doing

**As a guest** (private window, don't sign in)
Pick tickets → name and email appear inline, no sign-in wall → optionally
"Have a promo code?" → `SINGJAMTEST` → Buy → **click "Card" in the accordion**,
it starts collapsed → pay → you should land on the completion page and get an
email with a 6-character door code.

**As a member** (sign in as the member account)
Same flow, no name/email step. After paying you should also appear as attending
on the event page — guests deliberately don't, because `jam_rsvps.user_id` can't
be null.

**As the host** (sign in as the host account)
Open the manage page. Add and delete tiers; try deleting one that has sales (it
refuses on purpose). Watch sold / gross / checked-in update. Search the guest
list by name, email or code, and use **Check in** — tap again to undo.

## Why the event is dated April

Official events are world-readable, and the jams listing only fetches the last
90 days. Dating this one **120 days in the past** keeps it out of every public
listing, upcoming and past, while still working on a direct link. Verified: it's
absent from both queries as an anonymous visitor, and `ticket_orders` / `tickets`
aren't readable anonymously at all.

It does mean you're reviewing an event dated April. That's the price of not
putting a test event on the live site.

## Known cosmetic issue

Stripe's Payment Element accordion lists **Klarna and Bank**, even though the
session correctly excludes buy-now-pay-later — the session's
`payment_method_types` is `card, link, cashapp, amazon_pay`, verified directly.
So the exclusion works where it counts, but the Element seems to advertise more
than the session permits. Worth an eyeball; if a Klarna attempt actually fails,
that needs fixing before launch.

## Running it again

```bash
# from the repo root
node scripts/ticketing-test-env.mjs status     # what exists right now
node scripts/ticketing-test-env.mjs seed       # idempotent — safe to re-run
node scripts/ticketing-test-env.mjs teardown   # removes event, tiers, orders, accounts, promo code
```

Services, if they need restarting:

```bash
cd apps/web && PORT=3000 npm run dev
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

`stripe listen` must be running or payments will complete at Stripe and the order
will sit at "Confirming your payment…" forever — localhost isn't reachable from
Stripe's servers. Its signing secret already matches `.env.local`.

**Don't run `npm run build` while the dev server is up** — they share `.next` and
the build wipes it out from under the running server.

## When you're done

Run `teardown`. It removes the event, its tiers, orders and tickets, both test
accounts, and deactivates the promo code — production goes back to how it was.
