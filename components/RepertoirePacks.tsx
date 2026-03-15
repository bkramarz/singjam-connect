"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Pack = { id: string; name: string; description: string | null; };
type PackSong = { song_id: string; };
type Song = { id: string; title: string; artist: string | null; };

const LEVELS = [
  { key: "lead", label: "I can lead" },
  { key: "support", label: "I can support" },
  { key: "follow", label: "I can follow" },
  { key: "learn", label: "Want to learn" },
] as const;

export default function RepertoirePacks({ packs }: { packs: Pack[] }) {
  const supabase = supabaseBrowser();
  const [selectedPack, setSelectedPack] = useState<string | null>(packs[0]?.id ?? null);
  const [packSongs, setPackSongs] = useState<PackSong[]>([]);
  const [songMap, setSongMap] = useState<Record<string, Song>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number]["key"]>("support");

  useEffect(() => {
    (async () => {
      const { data: songs } = await supabase.from("songs").select("id,title,artist").limit(5000);
      const m: Record<string, Song> = {};
      (songs ?? []).forEach((s: any) => (m[s.id] = s));
      setSongMap(m);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!selectedPack) return;
    (async () => {
      const { data } = await supabase.from("song_pack_songs").select("song_id").eq("pack_id", selectedPack);
      setPackSongs((data as any) ?? []);
    })();
  }, [selectedPack, supabase]);

  async function addPackToMyRepertoire() {
    setBusy(true);
    setStatus(null);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setBusy(false); setStatus("Not signed in."); return; }

    const rows = packSongs.map((ps) => ({
      user_id: uid,
      song_id: ps.song_id,
      confidence: level,
      updated_at: new Date().toISOString(),
    }));

    // Upsert so repeated adds just updates confidence
    const { error } = await supabase.from("user_songs").upsert(rows, { onConflict: "user_id,song_id" });
    setBusy(false);
    setStatus(error ? error.message : "Added to your repertoire.");
  }

  const selected = packs.find((p) => p.id === selectedPack);

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="text-sm font-medium">Community song packs</div>
          <select className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={selectedPack ?? ""} onChange={(e) => setSelectedPack(e.target.value)}>
            {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selected?.description && <div className="mt-1 text-xs text-zinc-500">{selected.description}</div>}
        </div>

        <div>
          <div className="text-sm font-medium">Mark as</div>
          <select className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value as any)}>
            {LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>

        <button onClick={addPackToMyRepertoire} disabled={busy || !selectedPack}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {busy ? "Adding..." : "Add this pack"}
        </button>
      </div>

      <div className="text-sm text-zinc-600">
        {packSongs.length} songs in this pack.
      </div>

      <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200">
        <ul className="divide-y divide-zinc-200">
          {packSongs.map((ps) => {
            const s = songMap[ps.song_id];
            return (
              <li key={ps.song_id} className="px-3 py-2 text-sm">
                <span className="font-medium">{s?.title ?? "Song"}</span>
                {s?.artist ? <span className="text-zinc-500"> — {s.artist}</span> : null}
              </li>
            );
          })}
        </ul>
      </div>

      {status && <div className="text-sm text-zinc-600">{status}</div>}
    </div>
  );
}
