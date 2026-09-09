"use client";

import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider } from "@stripe/react-stripe-js/checkout";
import TicketCheckoutForm from "./TicketCheckoutForm";

// Loaded once at module scope, not per render — re-calling loadStripe on every
// render refetches Stripe.js and drops the mounted Element.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/**
 * The card form, alone on the page. Same narrow column the tier list uses, so
 * the two steps line up instead of the layout jumping between them.
 *
 * TicketCheckoutForm is left exactly as it was — it owns the "Back to tickets"
 * affordances and the confirm button, and it is the last thing between a buyer
 * and their money, so it gets a navigating callback rather than an edit. Going
 * back is safe now in a way it was not before: the selection is already
 * reserved server-side under this order, so returning here reloads the same
 * held order instead of minting a second one.
 */
export default function TicketPaymentPanel({
  clientSecret,
  amountCents,
  currency,
  backHref,
}: {
  clientSecret: string;
  amountCents: number;
  currency: string;
  backHref: string;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-sm space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-700">Payment</h1>
        <p className="text-sm font-semibold tabular-nums text-zinc-900">
          {money(amountCents, currency)}
        </p>
      </div>

      <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret }}>
        <TicketCheckoutForm onBack={() => router.push(backHref)} />
      </CheckoutElementsProvider>

      <p className="text-xs text-zinc-400">
        Your tickets are held while you pay. Payments are processed by Stripe.
      </p>
    </div>
  );
}
