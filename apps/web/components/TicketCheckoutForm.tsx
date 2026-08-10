"use client";

import { useState } from "react";
import { PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";

export default function TicketCheckoutForm({ onBack }: { onBack: () => void }) {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Do NOT call checkout.updateEmail() here. The session is created with
  // customer_email set server-side, and updateEmail then throws "You cannot
  // update the email because a customer_email or customer with an email is
  // already set on the Checkout Session" — which, thrown during render, stops
  // the Payment Element mounting at all.

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="h-11 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-11 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-200" />
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{checkoutState.error.message}</p>
        <button onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-700">
          Back to tickets
        </button>
      </div>
    );
  }

  const { checkout } = checkoutState;
  const total = checkout.total?.total?.amount;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await checkout.confirm();
    // On success the browser is redirected to return_url, so reaching here with
    // a result generally means it failed. Fulfilment is never done from this
    // callback — the webhook is the source of truth.
    if (result?.type === "error") setError(result.error.message ?? "Payment failed");
    setBusy(false);
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement options={{ layout: "accordion" }} />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        // Deliberately NOT gated on checkout.canConfirm. That value is a
        // snapshot taken when this component rendered, and completing the card
        // inside Stripe's iframe does not re-render us — so it stays false
        // forever and the button is permanently disabled, with no way for
        // anyone to pay. Verified in a browser: card complete, canConfirm still
        // false. confirm() validates and returns a readable error instead.
        disabled={busy}
        className="w-full rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
      >
        {busy ? "Processing…" : total ? `Pay ${total}` : "Pay"}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="w-full text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
      >
        Back to tickets
      </button>
    </form>
  );
}
