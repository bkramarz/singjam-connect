"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function HomeButtons() {
  const [signedIn, setSignedIn] = useState(false);
  const supabase = supabaseBrowser();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
    });
  }, [supabase]);

  if (signedIn) {
    return (
      <>
        <Link
          href="/search"
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-400 transition-colors"
        >
          Add songs
        </Link>
        <Link
          href="/jams"
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 transition-colors"
        >
          Join a jam
        </Link>
      </>
    );
  }

  return (
    <Link
      href="/auth"
      className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-400 transition-colors"
    >
      Join us
    </Link>
  );
}
