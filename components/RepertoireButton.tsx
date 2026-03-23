"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "follow", label: "Follow" },
  { key: "learn", label: "Learn" },
] as const;

type Level = (typeof LEVELS)[number]["key"];

export default function RepertoireButton({
  songId,
  initialConfidence,
}: {
  songId: string;
  initialConfidence: string | null;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [confidence, setConfidence] = useState(initialConfidence);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfidence(initialConfidence);
    setPicking(false);
  }, [initialConfidence]);

  async function getSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { router.push("/auth"); return null; }
    return data.session;
  }

  async function save(level: Level) {
    setSaving(true);
    const session = await getSession();
    if (!session) return;

    const { error } = await supabase.from("user_songs").upsert(
      {
        user_id: session.user.id,
        song_id: songId,
        confidence: level,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,song_id" }
    );

    setSaving(false);
    if (!error) {
      setConfidence(level);
      setPicking(false);
      router.refresh();
    }
  }

  async function remove() {
    setSaving(true);
    const session = await getSession();
    if (!session) return;

    const { error } = await supabase
      .from("user_songs")
      .delete()
      .eq("user_id", session.user.id)
      .eq("song_id", songId);

    setSaving(false);
    if (!error) {
      setConfidence(null);
      router.refresh();
    }
  }

  const confidenceLabel = LEVELS.find((l) => l.key === confidence)?.label;

  if (picking) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Add as:</span>
        {LEVELS.map((l) => (
          <button
            key={l.key}
            disabled={saving}
            onClick={() => save(l.key)}
            className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-40"
          >
            {l.label}
          </button>
        ))}
        <button
          onClick={() => setPicking(false)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          ✕
        </button>
      </div>
    );
  }

  if (confidence !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm text-amber-700">
          ✓ In your repertoire{confidenceLabel ? ` · ${confidenceLabel}` : ""}
        </span>
        <button
          onClick={() => setPicking(true)}
          disabled={saving}
          className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Update
        </button>
        <button
          onClick={remove}
          disabled={saving}
          className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setPicking(true)}
      className="rounded-xl border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      + Add to repertoire
    </button>
  );
}
