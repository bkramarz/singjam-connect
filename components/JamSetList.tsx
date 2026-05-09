"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LinkedSet = { id: string; name: string };

export default function JamSetList({ jamId, jamName }: { jamId: string; jamName: string | null }) {
  const router = useRouter();
  const [set, setSet] = useState<LinkedSet | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`/api/jam/${jamId}/set`)
      .then((r) => r.json())
      .then(({ set }) => setSet(set ?? null));
  }, [jamId]);

  async function handleCreate() {
    setCreating(true);
    const name = jamName ? `${jamName} – set list` : "Set list";
    const res = await fetch("/api/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, jamId }),
    });
    const { id } = await res.json();
    router.push(`/set/${id}`);
  }

  if (set === undefined) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <h2 className="text-base font-semibold">Set list</h2>
      {set ? (
        <a
          href={`/set/${set.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          {set.name}
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">
            Create a set list for this jam — attendees will be added as collaborators automatically.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Create set list"}
          </button>
        </div>
      )}
    </div>
  );
}
