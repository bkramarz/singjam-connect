"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/client";
import InviteToJamButton from "@/components/InviteToJamButton";

const SINGING_LABEL: Record<string, string> = {
  lead: "Lead vocals",
  backup: "Backup vocals",
  none: "Doesn't sing",
};

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
        Matches are ranked by shared songs and genre overlap.
      </p>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {matches.map((m: any) => {
          const fullName = [m.display_name, m.last_name].filter(Boolean).join(" ");
          const singingVoices: string[] = m.singing_voice ? m.singing_voice.split(",").filter((v: string) => v !== "none") : [];
          const instrumentLevels: Record<string, string> = m.instrument_levels ?? {};
          const topInstruments = Object.entries(instrumentLevels)
            .sort(([, a], [, b]) => {
              const order = ["Professional", "Advanced", "Intermediate", "Beginner"];
              return order.indexOf(a) - order.indexOf(b);
            })
            .slice(0, 3)
            .map(([name]) => name);
          const sharedGenres: string[] = m.shared_genres ?? [];
          const initial = (m.display_name ?? m.username ?? "?")[0].toUpperCase();

          return (
            <div key={m.user_id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                  {m.avatar_url ? (
                    <Image src={m.avatar_url} alt={fullName || "Avatar"} fill className="object-cover" unoptimized />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-400">
                      {initial}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-zinc-900">
                    {fullName || m.username || "Someone"}
                    {m.username && <span className="ml-1.5 text-xs font-normal text-zinc-400">@{m.username}</span>}
                  </div>
                  {m.neighborhood && <div className="text-xs text-zinc-500">{m.neighborhood}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-zinc-900">{m.shared_count}</div>
                  <div className="text-xs text-zinc-400">shared songs</div>
                </div>
              </div>

              {/* Badges */}
              {(singingVoices.length > 0 || topInstruments.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {singingVoices.map((v: string) => (
                    <span key={v} className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-700">
                      {SINGING_LABEL[v] ?? v}
                    </span>
                  ))}
                  {topInstruments.map((name) => (
                    <span key={name} className="rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600">
                      {name}
                    </span>
                  ))}
                </div>
              )}

              {/* Shared songs */}
              {Array.isArray(m.top_shared) && m.top_shared.length > 0 && (
                <div className="mt-3 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">Shared songs: </span>
                  {m.top_shared.slice(0, 5).join(", ")}
                  {m.top_shared.length > 5 && ` +${m.top_shared.length - 5} more`}
                </div>
              )}

              {/* Shared genres */}
              {sharedGenres.length > 0 && (
                <div className="mt-1.5 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">Shared genres: </span>
                  {sharedGenres.slice(0, 5).join(", ")}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <a
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-center text-sm no-underline hover:bg-zinc-50 sm:flex-none sm:py-1.5"
                  href={m.username ? `/u/${m.username}` : `/profile/${m.user_id}`}
                >
                  View profile
                </a>
                <InviteToJamButton inviteeUserId={m.user_id} />
              </div>
            </div>
          );
        })}
      </div>

      {matches.length === 0 && (
        <div className="text-sm text-zinc-600">
          No matches yet — add songs to your repertoire to find jammers with shared repertoire.
        </div>
      )}
    </div>
  );
}
