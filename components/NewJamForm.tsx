"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const JAM_TYPES = [
  "Casual circle",
  "Structured rehearsal",
  "Spiritual circle",
  "Song-share night",
] as const;

export default function NewJamForm() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [jamType, setJamType] = useState<(typeof JAM_TYPES)[number]>("Casual circle");
  const [startsAt, setStartsAt] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createJam() {
    if (!neighborhood.trim()) { setError("Please enter a neighborhood or area."); return; }
    setBusy(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setBusy(false); setError("Not signed in."); return; }

    const { data, error: err } = await supabase
      .from("jams")
      .insert({
        host_user_id: uid,
        jam_type: jamType,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        neighborhood: neighborhood.trim(),
        notes: notes.trim() || null,
        visibility: "radius",
      })
      .select("id")
      .single();

    setBusy(false);
    if (err) { setError(err.message); return; }
    router.push(`/jam/${data.id}`);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium">Jam style</label>
        <select
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={jamType}
          onChange={(e) => setJamType(e.target.value as any)}
        >
          {JAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">When</label>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-400">Leave blank if the date is flexible.</p>
      </div>

      <div>
        <label className="block text-sm font-medium">Neighborhood / area <span className="text-red-400">*</span></label>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="e.g. North Berkeley, Mission District…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Vibe, instruments welcome, how many people you're looking for, etc."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={createJam}
        disabled={busy}
        className="w-full rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
      >
        {busy ? "Posting…" : "Post jam"}
      </button>
    </div>
  );
}
