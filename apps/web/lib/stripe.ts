import Stripe from "stripe";

let client: Stripe | null = null;

// Constructed lazily on first call, not at module load, and memoised after.
// stripe-node throws "Neither apiKey nor config.authenticator provided" when the
// key is missing, and Next evaluates route modules while collecting page data —
// so a module-level `new Stripe(...)` fails the build on any machine without the
// key set, including CI and Netlify. Same shape as supabaseAdmin() for the same
// reason. (lib/resend.ts can get away with module-level construction only
// because Resend tolerates an undefined key.)
//
// STRIPE_RESTRICTED_KEY holds a restricted key (rk_), not a secret key (sk_) —
// least privilege, so a leak can do far less. Keep separate keys per environment.
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_RESTRICTED_KEY;
    if (!key) throw new Error("STRIPE_RESTRICTED_KEY is not set");
    // apiVersion is deliberately not passed: stripe-node v12+ pins the API
    // version to the installed package release, and overriding it desynchronises
    // the TypeScript types from the wire format. Match the webhook endpoint's
    // version to the SDK instead of pinning here.
    client = new Stripe(key);
  }
  return client;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://singjam.org";

// Tags Checkout Sessions so flows can be compared in the Dashboard. Stripe asks
// for an 8-random-letter suffix on the label.
export const TICKET_INTEGRATION_ID = "singjam_tickets_qxwmvpht";

// Buy-now-pay-later is a poor fit for a $15 concert ticket, so it is excluded
// from ticket checkouts specifically rather than disabled account-wide — the org
// may still want it elsewhere. Klarna was the one actually surfacing; affirm and
// afterpay_clearpay are also active on the account and would appear at higher
// ticket prices, so they are excluded for the same reason.
//
// This is the supported way to narrow the offering. Never reach for
// payment_method_types — that would disable dynamic payment methods entirely and
// freeze the list at whatever we hardcode.
export const EXCLUDED_PAYMENT_METHODS = [
  "klarna",
  "affirm",
  "afterpay_clearpay",
] as const;

// Stripe rejects expires_at below 30 minutes from creation, so that is the floor
// for the payable window.
export const SESSION_EXPIRY_MINUTES = 30;

// The database hold must OUTLIVE the Stripe session, not match it. Stripe refuses
// payment on an expired session, so making the session die first guarantees any
// successful payment arrives while the order is still 'pending' — which is the
// state the webhook's guarded update requires. Were the hold shorter, a payment
// at minute 29 could land after the sweeper released the stock and resold it:
// money taken, no ticket, and the webhook's `.eq("status", "pending")` silently
// matching nothing.
export const HOLD_MINUTES = SESSION_EXPIRY_MINUTES + 5;
