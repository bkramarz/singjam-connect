"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const JAM_TYPES = ["Casual circle", "Structured rehearsal", "Spiritual circle", "Song-share night"] as const;

export default function NewJamForm() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [name, setName] = useState<string>("");
  const [ticketsUrl, setTicketsUrl] = useState<string>("");
  const [jamType, setJamType] = useState<(typeof JAM_TYPES)[number]>("Casual circle");
  const [startsAt, setStartsAt] = useState<string>("");
  const [neighborhood, setNeighborhood] = useState<string>("Berkeley");
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("profiles").select("is_admin").eq("id", uid).single().then(({ data: p }) => {
        setIsAdmin(!!(p as any)?.is_admin);
      });
    });
  }, [supabase]);

  async function createJam() {
    setBusy(true);
    setStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setBusy(false); setStatus("Not signed in."); return; }

    const { data, error } = await supabase.from("jams").insert({
      host_user_id: uid,
      jam_type: jamType,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      neighborhood,
      notes: notes || null,
      visibility: isPublic ? "public" : "radius",
      name: isPublic && name ? name : null,
      tickets_url: isPublic && ticketsUrl ? ticketsUrl : null,
      created_at: new Date().toISOString(),
    }).select("*").single();

    setBusy(false);
    setStatus(error ? error.message : "Jam created!");
    if (!error && data?.id) router.push(`/jam/${data.id}`);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
      {isAdmin && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded border-zinc-300"
          />
          <span className="text-sm font-medium text-amber-600">Public SingJam event</span>
        </label>
      )}

      {isPublic && (
        <div>
          <label className="block text-sm font-medium">Event name</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SingJam Open Circle — April"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">Jam style</label>
        <select className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={jamType} onChange={(e) => setJamType(e.target.value as any)}>
          {JAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Start time</label>
        <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      </div>

      <div>
        <label className="block text-sm font-medium">{isPublic ? "Venue / address" : "Neighborhood"}</label>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder={isPublic ? "e.g. 123 Main St, Berkeley" : "e.g. Berkeley"}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional: vibe, roles needed, bring percussion, etc." />
      </div>

      {isPublic && (
        <div>
          <label className="block text-sm font-medium">Tickets URL</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            type="url"
            value={ticketsUrl}
            onChange={(e) => setTicketsUrl(e.target.value)}
            placeholder="https://humanitix.com/..."
          />
        </div>
      )}

      <button onClick={createJam} disabled={busy}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
        {busy ? "Creating..." : "Create jam"}
      </button>

      {status && <div className="text-sm text-zinc-600">{status}</div>}
    </div>
  );
}
