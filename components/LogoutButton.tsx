"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutButton({ variant = "dark" }: { variant?: "dark" | "light" }) {
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

  const className = variant === "light"
    ? "rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
    : "rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm";

  return (
    <button type="button" onClick={onLogout} className={className}>
      Log out
    </button>
  );
}
