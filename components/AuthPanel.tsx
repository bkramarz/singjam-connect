"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPanel() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithPassword() {
    setBusy(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);

    if (error) {
      setStatus(error.message);
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 p-5 shadow-sm">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Password</label>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
        />
      </div>

      <button
        onClick={signInWithPassword}
        disabled={!email || !password || busy}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>

      {status && <div className="text-sm text-red-600">{status}</div>}
    </div>
  );
}