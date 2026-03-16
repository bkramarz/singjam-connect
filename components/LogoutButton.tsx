"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm"
    >
      Log out
    </button>
  );
}
