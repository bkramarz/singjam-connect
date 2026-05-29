"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Level = "lead" | "support" | "learn";

const LEVELS: { key: Level; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "learn", label: "Learn" },
];

export default function ConfidencePicker({
  singingVoice,
  saving = false,
  onSave,
  onCancel,
  onVoiceUpdated,
  variant = "card",
}: {
  singingVoice: string | null;
  saving?: boolean;
  onSave: (level: Level) => void | Promise<void>;
  onCancel: () => void;
  onVoiceUpdated?: (voice: string) => void;
  variant?: "compact" | "card";
}) {
  const supabase = supabaseBrowser();
  const [localVoice, setLocalVoice] = useState(singingVoice);
  const [askingVoice, setAskingVoice] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);

  useEffect(() => { setLocalVoice(singingVoice); }, [singingVoice]);

  const isBlocked = (level: Level) =>
    level === "lead" && !localVoice?.split(",").includes("lead");

  async function handleVoiceConfirm() {
    setSavingVoice(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from("profiles").update({ singing_voice: "lead,backup" }).eq("id", session.user.id);
      setLocalVoice("lead,backup");
      onVoiceUpdated?.("lead,backup");
    }
    setSavingVoice(false);
    setAskingVoice(false);
    await onSave("lead");
  }

  const isCompact = variant === "compact";
  const wrap = isCompact ? "flex flex-wrap items-center gap-1.5" : "flex flex-wrap items-center gap-2";

  if (askingVoice) {
    return (
      <div className={wrap}>
        <span className={isCompact ? "text-xs text-zinc-500 font-medium" : "text-sm text-zinc-500"}>
          Can you sing?
        </span>
        <button
          disabled={savingVoice}
          onClick={handleVoiceConfirm}
          className={isCompact
            ? "rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-800 hover:opacity-80 transition-opacity disabled:opacity-50"
            : "rounded-xl border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          }
        >
          Yes
        </button>
        <button
          disabled={savingVoice}
          onClick={() => setAskingVoice(false)}
          className={isCompact
            ? "text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
            : "rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
          }
        >
          Not now
        </button>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <span className={isCompact ? "text-xs text-zinc-500 font-medium" : "text-sm text-zinc-500"}>
        {isCompact ? "I know this:" : "Add as:"}
      </span>
      {LEVELS.map(({ key, label }) => {
        const blocked = isBlocked(key);
        return (
          <button
            key={key}
            disabled={saving}
            onClick={async () => {
              if (blocked) { setAskingVoice(true); return; }
              await onSave(key);
            }}
            className={isCompact
              ? `rounded-full px-2 py-0.5 text-xs transition-opacity disabled:opacity-50 ${
                  blocked
                    ? "bg-zinc-100 text-zinc-400"
                    : key === "lead"
                    ? "bg-amber-100 text-amber-800 font-semibold hover:opacity-80"
                    : key === "support"
                    ? "bg-zinc-100 text-zinc-700 hover:opacity-80"
                    : "bg-zinc-100 text-zinc-500 hover:opacity-80"
                }`
              : `rounded-xl border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                  blocked
                    ? "border-zinc-200 bg-zinc-100 text-zinc-400"
                    : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 delay-150"
                }`
            }
          >
            {label}
          </button>
        );
      })}
      <button
        onClick={onCancel}
        className={isCompact
          ? "text-xs text-zinc-400 hover:text-zinc-600"
          : "rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
        }
      >
        {isCompact ? "Cancel" : "✕"}
      </button>
    </div>
  );
}
