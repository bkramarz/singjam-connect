"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitSongForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/songs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), artist: artist.trim() }),
    });
    const json = await res.json();
    setBusy(false);

    if (res.status === 409) {
      // Already exists — send them to the existing song
      setError("This song is already in our library.");
      if (json.slug) setTimeout(() => router.push(`/songs/${json.slug}`), 1500);
      return;
    }

    if (!res.ok) {
      setError(json.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(`/songs/${json.slug}`);
  }

  if (!open) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-4 text-center">
        <p className="text-sm text-zinc-500">Can't find your song?</p>
        <button
          onClick={() => setOpen(true)}
          className="mt-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
        >
          Add a missing song
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Add a missing song</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          We'll look it up and add it to the library. It'll be available for you to add to your repertoire straight away.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Song title <span className="text-red-500">*</span></label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Proud Mary"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Recording artist</label>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="e.g. Creedence Clearwater Revival"
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {busy && (
        <p className="text-xs text-zinc-400">Looking up song info — this may take a few seconds…</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={busy || !title.trim()}
          className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
        >
          {busy ? "Adding…" : "Add song"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          disabled={busy}
          className="rounded-xl border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
