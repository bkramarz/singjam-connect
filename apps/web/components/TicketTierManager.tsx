"use client";

import { useCallback, useEffect, useState } from "react";

type Tier = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  quantity: number | null;
  sold: number;
  held: number;
  remaining: number | null;
  on_sale: boolean;
};

type Guest = {
  ticket_id: string;
  code: string;
  name: string;
  email: string | null;
  tier: string;
  is_member: boolean;
  checked_in_at: string | null;
};

type Summary = {
  tickets_sold: number;
  orders: number;
  gross_cents: number;
  currency: string;
  checked_in: number;
};

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

// Prices are entered in dollars but stored in cents. Rounding here rather than
// truncating means 19.99 doesn't silently become 19.98 through float error.
const toCents = (dollars: string) => Math.round(parseFloat(dollars || "0") * 100);

export function TicketManagerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-zinc-200 p-3">
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-6 w-12 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-100" />
      ))}
    </div>
  );
}

export default function TicketTierManager({ jamId }: { jamId: string }) {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  // Draft state for the add form
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  const load = useCallback(async () => {
    const [tRes, oRes] = await Promise.all([
      fetch(`/api/jam/${jamId}/tickets/types`).then((r) => r.json()),
      fetch(`/api/jam/${jamId}/tickets/orders`).then((r) => r.json()),
    ]);
    setTiers(tRes.ticket_types ?? []);
    setGuests(oRes.guests ?? []);
    setSummary(oRes.summary ?? null);
  }, [jamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(method: "POST" | "PATCH" | "DELETE", body?: unknown, qs = "") {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/jam/${jamId}/tickets/types${qs}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong");
      return false;
    }
    await load();
    return true;
  }

  async function addTier(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send("POST", {
      name: name.trim(),
      price_cents: toCents(price),
      quantity: quantity.trim() === "" ? null : Number(quantity),
      sort_order: tiers?.length ?? 0,
    });
    if (ok) {
      setName("");
      setPrice("");
      setQuantity("");
    }
  }

  async function toggleCheckIn(g: Guest) {
    setError(null);
    const checkingIn = !g.checked_in_at;

    // Optimistic: at a door the feedback needs to be instant, and the request is
    // idempotent either way.
    setGuests((prev) =>
      prev.map((x) =>
        x.ticket_id === g.ticket_id
          ? { ...x, checked_in_at: checkingIn ? new Date().toISOString() : null }
          : x
      )
    );
    setSummary((s) => (s ? { ...s, checked_in: s.checked_in + (checkingIn ? 1 : -1) } : s));

    const res = checkingIn
      ? await fetch(`/api/jam/${jamId}/tickets/checkin`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ticket_id: g.ticket_id }),
        })
      : await fetch(`/api/jam/${jamId}/tickets/checkin?ticket_id=${g.ticket_id}`, { method: "DELETE" });

    if (!res.ok) {
      setError((await res.json()).error ?? "Check-in failed");
      await load(); // roll back to whatever the server actually thinks
      return;
    }
    const json = await res.json();
    if (json.already_checked_in) {
      setGuests((prev) =>
        prev.map((x) => (x.ticket_id === g.ticket_id ? { ...x, checked_in_at: json.checked_in_at } : x))
      );
    }
  }

  const filtered = guests.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      g.name.toLowerCase().includes(q) ||
      (g.email ?? "").toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q)
    );
  });

  if (tiers === null) return <TicketManagerSkeleton />;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 p-3">
            <p className="text-xs font-medium tracking-wide text-zinc-500">Tickets sold</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{summary.tickets_sold}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3">
            <p className="text-xs font-medium tracking-wide text-zinc-500">Gross</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {money(summary.gross_cents, summary.currency)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3">
            <p className="text-xs font-medium tracking-wide text-zinc-500">Checked in</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {summary.checked_in}/{summary.tickets_sold}
            </p>
          </div>
        </div>
      )}

      {summary && summary.gross_cents > 0 && (
        <p className="text-xs text-zinc-400">
          Gross before Stripe fees. Payouts and fees are in the Stripe Dashboard.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-700">Ticket tiers</h2>

        {tiers.length === 0 && (
          <p className="text-sm text-zinc-500">
            No tiers yet. Add one below and it appears on the event page immediately.
          </p>
        )}

        {tiers.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{t.name}</p>
              <p className="text-xs text-zinc-500">
                {money(t.price_cents, t.currency)} · {t.sold} sold
                {t.quantity !== null ? ` of ${t.quantity}` : " · unlimited"}
                {t.remaining === 0 ? " · sold out" : ""}
              </p>
              {/* A hold is a checkout in progress, not a sale. Shown separately
                  so an abandoned cart doesn't read as revenue. */}
              {t.held > 0 && (
                <p className="text-xs text-amber-600">
                  {t.held} held in checkout · frees up if unpaid
                </p>
              )}
            </div>
            <button
              onClick={() => send("DELETE", undefined, `?type_id=${t.id}`)}
              disabled={busy || t.sold > 0}
              title={
                t.sold > 0
                  ? "Tiers with sales can't be deleted"
                  : t.held > 0
                  ? "Someone is checking out — this may fail until their hold clears"
                  : "Delete tier"
              }
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
          </div>
        ))}

        <form onSubmit={addTier} className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              aria-label="Tier name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="General"
              required
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <input
              aria-label="Price in dollars"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="15.00"
              inputMode="decimal"
              required
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <input
              aria-label="Quantity, blank for unlimited"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty (blank = ∞)"
              inputMode="numeric"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || price.trim() === ""}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            Add tier
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-700">
          Guest list {guests.length > 0 && <span className="font-normal text-zinc-400">({guests.length})</span>}
        </h2>

        {guests.length === 0 ? (
          <p className="text-sm text-zinc-500">No tickets sold yet.</p>
        ) : (
          <>
            {/* Name/code search is the door workflow — no camera needed. */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or code"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs tracking-wide text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Tier</th>
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 font-medium text-right">Door</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g) => (
                    <tr key={g.ticket_id} className="border-t border-zinc-100">
                      <td className="py-2 pr-3">
                        <span className="text-zinc-900">{g.name}</span>
                        {!g.is_member && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                            guest
                          </span>
                        )}
                        {g.email && <p className="text-xs text-zinc-400">{g.email}</p>}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">{g.tier}</td>
                      <td className="py-2 pr-3 font-mono text-xs tracking-wider text-zinc-500">{g.code}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => toggleCheckIn(g)}
                          className={
                            g.checked_in_at
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 transition-colors"
                              : "rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                          }
                          title={g.checked_in_at ? "Tap to undo" : "Check in"}
                        >
                          {g.checked_in_at ? "✓ In" : "Check in"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-3 text-sm text-zinc-500">No one matches “{search}”.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
