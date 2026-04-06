"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import Tooltip from "@/components/Tooltip";

type JamOption = { id: string; name: string | null; starts_at: string | null };

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function InviteToJamButton({ inviteeUserId, disabled = false }: { inviteeUserId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [jams, setJams] = useState<JamOption[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabase = supabaseBrowser();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function loadJams() {
    if (jams !== null) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    const [{ data }, { data: invites }] = await Promise.all([
      supabase
        .from("jams")
        .select("id, name, starts_at")
        .eq("host_user_id", user.id)
        .neq("visibility", "official")
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(10),
      supabase
        .from("jam_invites")
        .select("jam_id")
        .eq("invited_user_id", inviteeUserId)
        .neq("status", "declined"),
    ]);

    const alreadyInvited = new Set((invites ?? []).map((i: any) => i.jam_id));
    setSent(alreadyInvited);
    setJams((data as JamOption[]) ?? []);
  }

  function toggle() {
    if (!open) loadJams();
    setOpen((v) => !v);
    setError(null);
  }

  async function invite(jamId: string) {
    setSending(jamId);
    setError(null);
    const res = await fetch(`/api/jam/${jamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteeUserId }),
    });
    const body = await res.json();
    if (res.ok) {
      setSent((prev) => new Set([...prev, jamId]));
    } else {
      setError(body.error ?? "Failed to send invite");
    }
    setSending(null);
  }

  const button = (
    <button
      onClick={disabled ? undefined : toggle}
      disabled={disabled}
      className={`w-full rounded-xl border px-3 py-2.5 text-center text-sm transition-colors ${
        disabled
          ? "border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      Invite to jam
    </button>
  );

  return (
    <div className="relative flex-1 sm:flex-none" ref={panelRef}>
      {disabled ? (
        <Tooltip message="Invites are currently unavailable">{button}</Tooltip>
      ) : (
        button
      )}

      {open && (
        <div className="absolute left-0 bottom-0 z-20 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
          {jams === null ? (
            <p className="px-4 py-3 text-sm text-zinc-400">Loading…</p>
          ) : jams.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">No upcoming jams to invite to.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 max-h-56 overflow-y-auto">
              {jams.map((j) => {
                const isSent = sent.has(j.id);
                const label = j.name ?? "Untitled jam";
                return (
                  <li key={j.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{label}</p>
                      {j.starts_at && <p className="text-xs text-zinc-400">{formatDate(j.starts_at)}</p>}
                    </div>
                    <button
                      onClick={() => invite(j.id)}
                      disabled={isSent || sending === j.id}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSent
                          ? "bg-green-100 text-green-700 cursor-default"
                          : "bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50"
                      }`}
                    >
                      {isSent ? "Sent" : sending === j.id ? "…" : "Invite"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="px-4 py-2 text-xs text-red-600 border-t border-zinc-100">{error}</p>}
        </div>
      )}
    </div>
  );
}
