"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type LookupItem = { id: string; name: string };

function MultiSelect({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: LookupItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              selected.includes(item.id)
                ? "border-amber-500 bg-amber-50 text-amber-700 font-medium"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewJamForm() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [visibility, setVisibility] = useState<"community" | "private" | "official">("community");

  const [genres, setGenres] = useState<LookupItem[]>([]);
  const [themes, setThemes] = useState<LookupItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [ticketsUrl, setTicketsUrl] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", uid).single();
        setIsAdmin(!!(p as any)?.is_admin);
      }
      const [{ data: g }, { data: t }] = await Promise.all([
        supabase.from("genres").select("id, name").order("name"),
        supabase.from("themes").select("id, name").order("name"),
      ]);
      setGenres((g as LookupItem[]) ?? []);
      setThemes((t as LookupItem[]) ?? []);
    }
    load();
  }, [supabase]);

  function toIso(d: string, t: string) {
    if (!d || !t) return null;
    return new Date(`${d}T${t}`).toISOString();
  }

  async function createJam() {
    setBusy(true);
    setStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setBusy(false); setStatus("Not signed in."); return; }

    const startsAt = toIso(date, startTime);
    const endsAt = toIso(date, endTime);

    const { data, error } = await supabase.from("jams").insert({
      host_user_id: uid,
      starts_at: startsAt,
      ends_at: endsAt,
      neighborhood: neighborhood || null,
      notes: notes || null,
      visibility,
      name: visibility === "official" && name ? name : null,
      tickets_url: visibility === "official" && ticketsUrl ? ticketsUrl : null,
      created_at: new Date().toISOString(),
    }).select("id").single();

    if (error || !data?.id) {
      setBusy(false);
      setStatus(error?.message ?? "Something went wrong.");
      return;
    }

    const jamId = data.id;

    // Insert genres and themes
    await Promise.all([
      selectedGenres.length > 0
        ? supabase.from("jam_genres").insert(selectedGenres.map((genre_id) => ({ jam_id: jamId, genre_id })))
        : Promise.resolve(),
      selectedThemes.length > 0
        ? supabase.from("jam_themes").insert(selectedThemes.map((theme_id) => ({ jam_id: jamId, theme_id })))
        : Promise.resolve(),
    ]);

    router.push(`/jam/${jamId}`);
  }

  const isOfficial = visibility === "official";

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-5">
      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Who can see this?</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              value="community"
              checked={visibility === "community"}
              onChange={() => setVisibility("community")}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm font-medium">Community jam</span>
              <p className="text-xs text-zinc-500">Visible to all SingJam members</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              value="private"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm font-medium">Private jam</span>
              <p className="text-xs text-zinc-500">Only visible to people you invite</p>
            </div>
          </label>
          {isAdmin && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="official"
                checked={visibility === "official"}
                onChange={() => setVisibility("official")}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-amber-600">Official SingJam event</span>
                <p className="text-xs text-zinc-500">Public — visible to anyone on the site</p>
              </div>
            </label>
          )}
        </div>
      </div>

      {isOfficial && (
        <div>
          <label className="block text-sm font-medium">Event name</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SingJam Open Circle — April"
          />
        </div>
      )}

      {/* Date and time */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Date &amp; time</label>
        <input
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Start time</label>
            <input
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">End time</label>
            <input
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Venue */}
      <div>
        <label className="block text-sm font-medium">{isOfficial ? "Venue / address" : "Neighborhood"}</label>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder={isOfficial ? "e.g. 123 Main St, Berkeley" : "e.g. Berkeley, Oakland"}
        />
      </div>

      {/* Genres */}
      {genres.length > 0 && (
        <MultiSelect
          label="Genres"
          items={genres}
          selected={selectedGenres}
          onChange={setSelectedGenres}
        />
      )}

      {/* Themes */}
      {themes.length > 0 && (
        <MultiSelect
          label="Themes"
          items={themes}
          selected={selectedThemes}
          onChange={setSelectedThemes}
        />
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Vibe, what to bring, skill level, etc."
        />
      </div>

      {isOfficial && (
        <div>
          <label className="block text-sm font-medium">Tickets URL</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            type="url"
            value={ticketsUrl}
            onChange={(e) => setTicketsUrl(e.target.value)}
            placeholder="https://humanitix.com/..."
          />
        </div>
      )}

      <button
        onClick={createJam}
        disabled={busy}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create jam"}
      </button>

      {status && <p className="text-sm text-red-600">{status}</p>}
    </div>
  );
}
