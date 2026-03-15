"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AccountPanel() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
      <button onClick={signOut} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50">
        Sign out
      </button>
    </div>
  );
}
