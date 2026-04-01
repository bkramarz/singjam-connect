"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JamHostActions({ jamId }: { jamId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteJam() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/jam/${jamId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/jams");
    } else {
      const body = await res.json();
      setError(body.error ?? "Something went wrong");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <h2 className="text-base font-semibold">Manage jam</h2>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/jam/${jamId}/edit`}
          className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Edit details
        </Link>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Cancel jam
          </button>
        ) : (
          <div className="flex-1 rounded-xl border border-red-300 bg-red-50 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-red-800">Cancel this jam? This can't be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
              >
                Keep it
              </button>
              <button
                onClick={deleteJam}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
