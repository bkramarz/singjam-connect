"use client";

import Link from "next/link";
import { useState } from "react";

type Invite = {
  id: string;
  invited_user_id: string | null;
  invitee_email: string | null;
  status: string;
  display_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Invited",
  accepted: "Going",
  declined: "Declined",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-500",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-50 text-red-500",
};

export default function JamInviteList({ jamId, invites }: { jamId: string; invites: Invite[] }) {
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function nudge(inviteId: string) {
    setNudging(inviteId);
    setNudgeError(null);
    const res = await fetch(`/api/jam/${jamId}/invite/nudge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    if (res.ok) {
      setNudged((prev) => new Set(prev).add(inviteId));
    } else {
      const body = await res.json().catch(() => ({}));
      setNudgeError(body.error ?? "Failed to send nudge");
    }
    setNudging(null);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <h2 className="text-base font-semibold">Invites</h2>
      {nudgeError && <p className="text-xs text-red-600">{nudgeError}</p>}
      <ul className="divide-y divide-zinc-100">
        {invites.map((inv) => {
          const fullName = [inv.display_name, inv.last_name].filter(Boolean).join(" ")
            || inv.username
            || inv.invitee_email
            || "Unknown";
          const sublabel = inv.invited_user_id && inv.invitee_email ? inv.invitee_email : null;
          const status = inv.status in STATUS_LABEL ? inv.status : "pending";
          const isPending = status === "pending";
          const alreadyNudged = nudged.has(inv.id);

          return (
            <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                {inv.username ? (
                  <Link href={`/u/${inv.username}`} className="text-sm text-zinc-900 hover:underline truncate block">
                    {fullName}
                    <span className="ml-1.5 text-xs text-zinc-400">@{inv.username}</span>
                  </Link>
                ) : (
                  <p className="text-sm text-zinc-900 truncate">{fullName}</p>
                )}
                {sublabel && (
                  <p className="text-xs text-zinc-400 truncate">{sublabel}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isPending && (
                  <button
                    onClick={() => nudge(inv.id)}
                    disabled={nudging === inv.id || alreadyNudged}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {alreadyNudged ? "Sent" : nudging === inv.id ? "Sending…" : "Nudge"}
                  </button>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
