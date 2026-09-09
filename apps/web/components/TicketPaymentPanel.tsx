"use client";

import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider } from "@stripe/react-stripe-js/checkout";
import type { PaymentLine } from "@/lib/ticketPaymentState";
import TicketCheckoutForm from "./TicketCheckoutForm";

// Loaded once at module scope, not per render — re-calling loadStripe on every
// render refetches Stripe.js and drops the mounted Element.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/**
 * The card form, alone on the page, above it the order it belongs to.
 *
 * The summary is read off the Checkout Session upstream, not rebuilt from our
 * tables, so the rows always add up to the amount on the button — Stripe holds
 * both the promotion-code discount and the processing-fee line.
 *
 * TicketCheckoutForm is left exactly as it was: it owns the "Back to tickets"
 * affordances and the confirm button, and it is the last thing between a buyer
 * and their money, so it gets a navigating callback rather than an edit. Going
 * back is safe now in a way it was not before — the selection is already
 * reserved server-side under this order, so returning reloads the same held
 * order instead of minting a second one.
 */
export default function TicketPaymentPanel({
  clientSecret,
  amountCents,
  currency,
  lines,
  discountCents,
  eventName,
  backHref,
}: {
  clientSecret: string;
  amountCents: number;
  currency: string;
  lines: PaymentLine[];
  discountCents: number;
  eventName: string | null;
  backHref: string;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <div>
        <h1 className="text-lg font-semibold leading-tight text-zinc-900">Checkout</h1>
        {eventName && <p className="mt-0.5 text-sm text-zinc-500">{eventName}</p>}
      </div>

      {/* Rendered only when the line items came back — never a summary that
          disagrees with the total, or an empty box where one should be. */}
      {lines.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
          <ul className="divide-y divide-zinc-100">
            {lines.map((line, i) => (
              <li key={`${line.label}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 text-zinc-700">
                  {line.label}
                  {line.quantity > 1 && (
                    <span className="text-zinc-400"> × {line.quantity}</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-700">
                  {money(line.amountCents, currency)}
                </span>
              </li>
            ))}

            {discountCents > 0 && (
              <li className="flex items-baseline justify-between gap-3 py-2 text-green-700">
                <span>Discount</span>
                <span className="shrink-0 tabular-nums">−{money(discountCents, currency)}</span>
              </li>
            )}

            <li className="flex items-baseline justify-between gap-3 py-2 font-semibold text-zinc-900">
              <span>Total</span>
              <span className="shrink-0 tabular-nums">{money(amountCents, currency)}</span>
            </li>
          </ul>
        </div>
      )}

      <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret }}>
        <TicketCheckoutForm onBack={() => router.push(backHref)} />
      </CheckoutElementsProvider>

      <p className="text-xs text-zinc-400">
        Your tickets are held while you pay. Payments are processed by Stripe.
      </p>
    </div>
  );
}
