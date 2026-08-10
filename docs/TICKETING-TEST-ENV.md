# Ticketing test environment

Everything is running. Open the links below and click through.

## The one thing to check first

The **Pay** button was permanently disabled until a fix late in this session, and
I could not complete a purchase headlessly to prove the fix works end to end —
Stripe loads an invisible hCaptcha, and headless browsers routinely fail it, so
`confirm()` never resolved for my automation and returned no error to inspect.

**So the first thing worth doing is a real purchase in a real browser.** If the
Pay button works and you land on the completion page, the flow is good. If it
doesn't, that's the bug to report and it's mine to fix.

Everything up to that point *is* verified automatically: the panel renders for a
logged-out visitor, tiers list, the stepper works, guest fields appear, the
checkout API reserves stock and returns a client secret, and Stripe's Payment
Element mounts with the correct total.

## Links

| | |
|---|---|
| Event page (buyer) | http://localhost:3457/jam/a13e41a1-ef3f-437b-9b34-7ec1a6ff09fd |
| Tickets & guest list (host) | http://localhost:3457/jam/a13e41a1-ef3f-437b-9b34-7ec1a6ff09fd/tickets/manage |

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
cd apps/web && PORT=3457 npm run dev
stripe listen --forward-to localhost:3457/api/stripe/webhook
```

`stripe listen` must be running or payments will complete at Stripe and the order
will sit at "Confirming your payment…" forever — localhost isn't reachable from
Stripe's servers. Its signing secret already matches `.env.local`.

**Don't run `npm run build` while the dev server is up** — they share `.next` and
the build wipes it out from under the running server.

## When you're done

Run `teardown`. It removes the event, its tiers, orders and tickets, both test
accounts, and deactivates the promo code — production goes back to how it was.
