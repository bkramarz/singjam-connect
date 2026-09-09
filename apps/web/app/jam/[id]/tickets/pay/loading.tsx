// The page retrieves the Stripe session server-side before it can render, so
// there is a real wait here. Mirrors the payment panel's column and the shape
// TicketCheckoutForm shows while Stripe.js mounts, so the two hand over without
// the layout jumping.
export default function TicketPaymentLoading() {
  return (
    <div className="mx-auto max-w-sm space-y-3" aria-busy="true">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-14 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="h-11 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-11 animate-pulse rounded-xl bg-zinc-200" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-200" />
      </div>
      <div className="h-3 w-56 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}
