"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import LogoutButton from "./LogoutButton";

export default function TopNav() {
  const supabase = supabaseBrowser();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
    });

    // Live updates on auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/songs" className="hover:underline">
        Songs
      </Link>
      <Link href="/repertoire" className="hover:underline">
        Repertoire
      </Link>
      <Link href="/matches" className="hover:underline">
        Find Jammers
      </Link>
      <Link href="/jam/new" className="hover:underline">
        Post a Jam
      </Link>

      <span className="mx-1 text-zinc-300">|</span>

      {signedIn ? (
        <>
          <Link href="/account" className="hover:underline">
            Account
          </Link>
          <span className="text-zinc-300">·</span>
          <LogoutButton />
        </>
      ) : (
        <Link href="/auth" className="hover:underline">
          Sign in
        </Link>
      )}
    </nav>
  );
}