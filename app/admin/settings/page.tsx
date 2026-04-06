"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Flag = { key: string; label: string; description: string };

const FLAGS: Flag[] = [
  {
    key: "jam_invites",
    label: "Jam invites",
    description: "Show invite buttons on jam pages, friend list, and user profiles.",
  },
];

export default function AdminSettingsPage() {
  const supabase = supabaseBrowser();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("feature_flags")
      .select("key, enabled")
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        for (const row of (data ?? []) as any[]) map[row.key] = row.enabled;
        setValues(map);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(key: string, enabled: boolean) {
    setSaving(key);
    await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled }),
    });
    setValues((prev) => ({ ...prev, [key]: enabled }));
    setSaving(null);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">Feature flags</h1>
      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {FLAGS.map((flag) => {
          const enabled = values[flag.key] ?? true;
          return (
            <div key={flag.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">{flag.label}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{flag.description}</p>
              </div>
              <button
                onClick={() => toggle(flag.key, !enabled)}
                disabled={saving === flag.key}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${enabled ? "bg-amber-500" : "bg-zinc-200"}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
