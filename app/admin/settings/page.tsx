"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ACSyncStatus } from "@/app/api/admin/ac-sync/route";

type Flag = { key: string; label: string; description: string };

const FLAGS: Flag[] = [
  {
    key: "jam_invites",
    label: "Jam invites",
    description: "Show invite buttons on jam pages, friend list, and user profiles.",
  },
];

const LIST_LABELS: Record<string, string> = {
  "1": "SMF",
  "4": "SingJam",
  "9": "Announcements",
};

export default function AdminSettingsPage() {
  const supabase = supabaseBrowser();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const [acStatus, setAcStatus] = useState<ACSyncStatus[] | null>(null);
  const [acLoading, setAcLoading] = useState(false);
  const [resyncing, setResyncing] = useState<Set<string>>(new Set());

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

  async function checkACStatus() {
    setAcLoading(true);
    const res = await fetch("/api/admin/ac-sync");
    const data: ACSyncStatus[] = await res.json();
    setAcStatus(data);
    setAcLoading(false);
  }

  async function resync(userIds: string[]) {
    setResyncing((prev) => new Set([...prev, ...userIds]));
    await fetch("/api/admin/ac-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    // Refresh status after resync
    const res = await fetch("/api/admin/ac-sync");
    const data: ACSyncStatus[] = await res.json();
    setAcStatus(data);
    setResyncing(new Set());
  }

  const usersWithIssues = (acStatus ?? []).filter(
    (s) => !s.inAC || !s.hasTag || s.missingLists.length > 0
  );

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="space-y-6">
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">ActiveCampaign sync</h2>
          <div className="flex gap-2">
            {acStatus !== null && usersWithIssues.length > 0 && (
              <button
                onClick={() => resync(usersWithIssues.map((s) => s.userId))}
                disabled={resyncing.size > 0}
                className="text-sm px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Resync all ({usersWithIssues.length})
              </button>
            )}
            <button
              onClick={checkACStatus}
              disabled={acLoading}
              className="text-sm px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-700 disabled:opacity-50"
            >
              {acLoading ? "Checking…" : acStatus === null ? "Check status" : "Refresh"}
            </button>
          </div>
        </div>

        {acStatus === null && !acLoading && (
          <p className="text-sm text-zinc-400">Click "Check status" to audit all users against ActiveCampaign.</p>
        )}

        {acLoading && (
          <p className="text-sm text-zinc-400">Fetching data from Supabase and ActiveCampaign…</p>
        )}

        {acStatus !== null && (
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">In AC</th>
                  <th className="px-4 py-3 font-medium">Tag</th>
                  <th className="px-4 py-3 font-medium">Lists</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {acStatus.map((s) => {
                  const clean = s.inAC && s.hasTag && s.missingLists.length === 0;
                  const isSyncing = resyncing.has(s.userId);
                  return (
                    <tr key={s.userId} className={clean ? "" : "bg-red-50"}>
                      <td className="px-4 py-3 text-zinc-700 font-mono text-xs">{s.email}</td>
                      <td className="px-4 py-3 text-center">
                        {s.inAC ? <span className="text-green-500">✓</span> : <span className="text-red-400">✗</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.hasTag ? <span className="text-green-500">✓</span> : <span className="text-red-400">✗</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.missingLists.length === 0 ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-red-400 text-xs">
                            missing {s.missingLists.map((id) => LIST_LABELS[id] ?? id).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!clean && (
                          <button
                            onClick={() => resync([s.userId])}
                            disabled={isSyncing}
                            className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
                          >
                            {isSyncing ? "Syncing…" : "Resync"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-zinc-100 text-xs text-zinc-400">
              {acStatus.length} users · {acStatus.filter((s) => s.inAC && s.hasTag && s.missingLists.length === 0).length} clean · {usersWithIssues.length} with issues
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
