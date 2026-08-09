import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

// Where Stripe returns the buyer after payment. This page only *reports* status —
// it never fulfils. Fulfilment is the webhook's job, because the buyer can close
// the tab before this renders and a client-side callback can't be trusted.
//
// That means the order may still read 'pending' here for a second or two while
// the webhook lands, so the pending state is framed as "confirming", not failure.

export default async function TicketsCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id: jamId } = await params;
  const { session_id } = await searchParams;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = supabaseAdmin();
  const { data: jam } = await admin.from("jams").select("name").eq("id", jamId).maybeSingle();

  const { data: order } = session_id
    ? await admin
        .from("ticket_orders")
        .select("id, status, amount_cents, currency, buyer_user_id")
        .eq("stripe_checkout_session_id", session_id)
        .maybeSingle()
    : { data: null };

  // A member's order is shown only to that member — a session id in the URL must
  // not expose someone else's purchase. A guest order has no account behind it,
  // so possession of the unguessable session id is the only credential there is;
  // this is the same model Stripe's own return-page samples use.
  const isGuestOrder = order != null && order.buyer_user_id === null;
  const mine = order && (isGuestOrder || (user && order.buyer_user_id === user.id)) ? order : null;

  const ticketCount = mine
    ? (await admin.from("tickets").select("id", { count: "exact", head: true }).eq("order_id", mine.id)).count ?? 0
    : 0;

  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

  const jamName = jam?.name ?? "the jam";

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      {mine?.status === "paid" ? (
        <>
          <h1 className="text-xl font-semibold text-zinc-900">You&apos;re going to {jamName}</h1>
          <p className="text-sm text-zinc-600">
            {ticketCount} ticket{ticketCount === 1 ? "" : "s"} ·{" "}
            {money(mine.amount_cents, mine.currency)} paid. A confirmation is on its way to your email.
          </p>
        </>
      ) : mine?.status === "pending" ? (
        <>
          <h1 className="text-xl font-semibold text-zinc-900">Confirming your payment…</h1>
          <p className="text-sm text-zinc-600">
            This usually takes a moment. Your tickets are held — refresh this page shortly, or check
            the event page.
          </p>
        </>
      ) : mine?.status === "refunded" ? (
        <>
          <h1 className="text-xl font-semibold text-zinc-900">This order was refunded</h1>
          <p className="text-sm text-zinc-600">Nothing further is owed.</p>
        </>
      ) : mine ? (
        <>
          <h1 className="text-xl font-semibold text-zinc-900">Payment didn&apos;t complete</h1>
          <p className="text-sm text-zinc-600">
            Your card wasn&apos;t charged and the tickets have been released. You can try again from
            the event page.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-zinc-900">Order not found</h1>
          <p className="text-sm text-zinc-600">
            We couldn&apos;t find that order. If you were charged, contact us and we&apos;ll sort it out.
          </p>
        </>
      )}

      <Link
        href={`/jam/${jamId}`}
        className="inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
      >
        Back to {jamName}
      </Link>
    </div>
  );
}
