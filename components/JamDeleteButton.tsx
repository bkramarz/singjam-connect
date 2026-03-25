"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function JamDeleteButton({ jamId }: { jamId: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Cancel this jam? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("jams").delete().eq("id", jamId);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.push("/jams");
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
    >
      {busy ? "Cancelling…" : "Cancel jam"}
    </button>
  );
}
