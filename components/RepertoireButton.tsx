"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import ConfidencePicker from "@/components/ConfidencePicker";

type Level = "lead" | "support" | "learn";

const LEVELS: { key: Level; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "learn", label: "Learn" },
];

export default function RepertoireButton({
  songId,
  initialConfidence,
  singingVoice = null,
  onConfidenceChange,
}: {
  songId: string;
  initialConfidence: string | null;
  singingVoice?: string | null;
  onConfidenceChange?: (level: string | null) => void;
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
      onConfidenceChange?.(level);
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
      onConfidenceChange?.(null);
      router.refresh();
    }
  }

  if (picking) {
    return (
      <ConfidencePicker
        singingVoice={singingVoice}
        saving={saving}
        onSave={save}
        onCancel={() => setPicking(false)}
      />
    );
  }

  if (confidence !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={confidence}
          disabled={saving}
          onChange={(e) => save(e.target.value as Level)}
          className={`rounded-xl border px-2 py-1.5 text-sm disabled:opacity-40 ${
            confidence === "lead"
              ? "border-amber-400 bg-amber-100 text-amber-800 font-semibold"
              : "border-slate-300"
          }`}
          aria-label="Role"
        >
          {LEVELS.map((l) => {
            const blocked = l.key === "lead" && !singingVoice?.split(",").includes("lead");
            return (
              <option key={l.key} value={l.key} disabled={blocked}>
                {blocked ? "Lead (singers only)" : l.label}
              </option>
            );
          })}
        </select>
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

  async function handleAddClick() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setPicking(true);
  }

  return (
    <button
      onClick={handleAddClick}
      className="rounded-xl bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 transition-colors"
    >
      + Add to repertoire
    </button>
  );
}
