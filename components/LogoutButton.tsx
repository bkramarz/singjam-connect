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
    router.refresh(); // ensures server-rendered auth state updates
    router.push("/"); // or "/auth" if you prefer
  };

  return (
    <button type="button" onClick={onLogout} className="hover:underline">
      Log out
    </button>
  );
}