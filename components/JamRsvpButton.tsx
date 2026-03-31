"use client";

import { useState } from "react";

type RsvpStatus = "attending" | "waitlist" | "cancelled" | null;

export default function JamRsvpButton({
  jamId,
  initialStatus,
  initialWaitlistPosition,
  attendingCount,
  capacity,
}: {
  jamId: string;
  initialStatus: RsvpStatus;
  initialWaitlistPosition: number | null;
  attendingCount: number;
  capacity: number | null;
}) {
  const [status, setStatus] = useState<RsvpStatus>(initialStatus);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(initialWaitlistPosition);
  const [busy, setBusy] = useState(false);

  const spotsLeft = capacity !== null ? capacity - attendingCount : null;
  const isFull = capacity !== null && spotsLeft !== null && spotsLeft <= 0;

  async function rsvp() {
    setBusy(true);
    const res = await fetch(`/api/jam/${jamId}/rsvp`, { method: "POST" });
    const json = await res.json();
    setStatus(json.status);
    setWaitlistPosition(json.waitlist_position ?? null);
    setBusy(false);
  }

  async function cancel() {
    setBusy(true);
    await fetch(`/api/jam/${jamId}/rsvp`, { method: "DELETE" });
    setStatus("cancelled");
    setWaitlistPosition(null);
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {capacity !== null && (
        <p className="text-xs text-zinc-500">
          {status === "attending"
            ? `${attendingCount} attending · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
            : isFull
            ? `${attendingCount}/${capacity} attending · Full`
            : `${attendingCount}/${capacity} attending · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
        </p>
      )}

      {status === "attending" ? (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            ✓ You're going
          </span>
          <button
            onClick={cancel}
            disabled={busy}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Cancel RSVP
          </button>
        </div>
      ) : status === "waitlist" ? (
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
            #{waitlistPosition} on waitlist
          </span>
          <button
            onClick={cancel}
            disabled={busy}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Leave waitlist
          </button>
        </div>
      ) : (
        <button
          onClick={rsvp}
          disabled={busy}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : isFull ? "Join waitlist" : "RSVP"}
        </button>
      )}
    </div>
  );
}
