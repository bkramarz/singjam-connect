"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function JamRsvpButton({
  jamId,
  userId,
  initialRsvp,
}: {
  jamId: string;
  userId: string | null;
  initialRsvp: boolean;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [going, setGoing] = useState(initialRsvp);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!userId) { router.push("/auth"); return; }
    setBusy(true);

    if (going) {
      await supabase
        .from("jam_invites")
        .delete()
        .eq("jam_id", jamId)
        .eq("invited_user_id", userId);
      setGoing(false);
    } else {
      await supabase.from("jam_invites").upsert(
        { jam_id: jamId, invited_user_id: userId, status: "accepted" },
        { onConflict: "jam_id,invited_user_id" }
      );
      setGoing(true);
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        going
          ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          : "bg-amber-500 text-white hover:bg-amber-400"
      }`}
    >
      {busy ? "…" : going ? "✓ Going · Cancel RSVP" : "I'm going"}
    </button>
  );
}
