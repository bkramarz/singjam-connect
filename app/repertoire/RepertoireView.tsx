"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const LEVELS = [
  { key: "lead", label: "Lead" },
  { key: "support", label: "Support" },
  { key: "follow", label: "Follow" },
  { key: "learn", label: "Learn" },
] as const;

type Item = {
  song_id: string;
  id: string; // songs.id
  title: string;
  display_artist: string | null;
  aka: string[] | null;
  level: string | null;
  created_at: string | null;
};

export default function RepertoireView({ initialItems }: { initialItems: Item[] }) {
  const supabase = supabaseBrowser();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((it) => {
      const matchesLevel = level === "all" ? true : (it.level ?? "") === level;
      if (!matchesLevel) return false;
      if (!q) return true;

      const hay = [it.title, it.display_artist ?? "", ...(it.aka ?? [])]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, query, level]);

  const removeFromRepertoire = async (song_id: string) => {
    startTransition(async () => {
      // RLS ensures only their row is deleted, but we also recommend unique(user_id, song_id)
      const { error } = await supabase.from("user_songs").delete().eq("song_id", song_id);

      if (error) {
        alert(error.message);
        return;
      }

      setItems((prev) => prev.filter((x) => x.song_id !== song_id));
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm">
        <div className="font-medium">Your repertoire is empty.</div>
        <div className="mt-1 text-muted-foreground">
          Go add some songs from the Songs page.
        </div>
        <Link
          href="/songs"
          className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Browse Songs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title / artist / aka…"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />

        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm sm:w-56"
        >
          <option value="all">All levels</option>
          {LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {items.length}
        {isPending ? "…" : ""}
      </div>

      <div className="divide-y rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No matches.</div>
        ) : (
          filtered.map((it) => (
            <div key={it.song_id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{it.title}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {it.display_artist ?? "—"}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-0.5">
                    {LEVELS.find((l) => l.key === it.level)?.label ??
                      it.level ??
                      "Unrated"}
                  </span>

                  {(it.aka ?? []).slice(0, 3).map((a) => (
                    <span key={a} className="rounded-full border px-2 py-0.5">
                      aka: {a}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => removeFromRepertoire(it.song_id)}
                className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}