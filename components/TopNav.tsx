"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import LogoutButton from "./LogoutButton";

export default function TopNav() {
  const supabase = supabaseBrowser();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/songs" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Songs
      </Link>
      <Link href="/repertoire" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Repertoire
      </Link>
      <Link href="/matches" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Find Jammers
      </Link>
      <Link href="/jam/new" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Post a Jam
      </Link>

      <div className="mx-2 h-4 w-px bg-slate-700" />

      {signedIn ? (
        <>
          <Link href="/account" className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            Account
          </Link>
          <LogoutButton />
        </>
      ) : (
        <Link
          href="/auth"
          className="rounded-lg bg-amber-500 px-3 py-1.5 font-medium text-white hover:bg-amber-400 transition-colors"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
