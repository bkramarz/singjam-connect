"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function MatchesPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/auth");
        return;
      }

      const { data: res, error } = await supabase.rpc("match_jammers", {
        for_user_id: session.user.id,
        limit_n: 30,
      });

      if (error) {
        console.error("Matching error:", error);
        setError("Could not load matches. Please try again.");
      }
      setMatches((res as any[]) ?? []);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="text-sm text-zinc-600">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Find jammers</h1>
      <p className="text-sm text-zinc-600">
        Matches are based on shared songs (weighted by confidence), roles, and neighborhood proximity (rough).
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Matching error: {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        {matches.map((m: any) => (
          <div key={m.user_id} className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-semibold">
                {m.display_name ?? "Someone"}{" "}
                <span className="text-xs text-zinc-500">({m.neighborhood ?? "Bay Area"})</span>
              </div>
              <div className="text-sm font-medium">{m.shared_count} shared songs</div>
            </div>

            <div className="mt-2 text-sm text-zinc-600">
              Top shared: {Array.isArray(m.top_shared) ? m.top_shared.slice(0, 5).join(", ") : ""}
            </div>

            <div className="mt-3 flex gap-2">
              <a className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm no-underline hover:bg-zinc-50" href={`/profile/${m.user_id}`}>
                View
              </a>
              <a className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm no-underline hover:bg-zinc-50" href={`/jam/new?invite=${m.user_id}`}>
                Invite
              </a>
            </div>
          </div>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="text-sm text-zinc-600">
          No matches yet — create a second test user and add some of the same songs to see matches appear.
        </div>
      ) : null}
    </div>
  );
}