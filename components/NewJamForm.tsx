"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import LocationAutocomplete from "./LocationAutocomplete";
import TagCombobox from "./TagCombobox";

type LookupItem = { id: string; name: string };

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
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  }

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

    // Upload image if provided
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${uid}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("jam-images")
        .upload(path, imageFile, { upsert: false });
      if (uploadError) {
        setBusy(false);
        setStatus(`Image upload failed: ${uploadError.message}`);
        return;
      }
      const { data: urlData } = supabase.storage.from("jam-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { data, error } = await supabase.from("jams").insert({
      host_user_id: uid,
      starts_at: toIso(date, startTime),
      ends_at: toIso(date, endTime),
      neighborhood: location || null,
      notes: description || null,
      visibility,
      name: visibility === "official" && name ? name : null,
      tickets_url: visibility === "official" && ticketsUrl ? ticketsUrl : null,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    }).select("id").single();

    if (error || !data?.id) {
      setBusy(false);
      setStatus(error?.message ?? "Something went wrong.");
      return;
    }

    const jamId = data.id;

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
      <div className="space-y-2">
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

      {/* Location */}
      <div>
        <label className="block text-sm font-medium mb-1">{isOfficial ? "Venue / address" : "Neighborhood or venue"}</label>
        <LocationAutocomplete
          value={location}
          onChange={setLocation}
          placeholder={isOfficial ? "e.g. Freight & Salvage, Berkeley" : "e.g. Berkeley, Oakland"}
        />
      </div>

      {/* Genres */}
      <TagCombobox
        label="Genres"
        options={genres}
        selected={selectedGenres}
        onChange={setSelectedGenres}
        placeholder="Search genres…"
      />

      {/* Themes */}
      <TagCombobox
        label="Themes"
        options={themes}
        selected={selectedThemes}
        onChange={setSelectedThemes}
        placeholder="Search themes…"
      />

      {/* Description */}
      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Vibe, what to bring, skill level, etc."
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Cover image</label>
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full rounded-xl object-cover max-h-48"
            />
            <button
              type="button"
              onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white hover:bg-black/70"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-zinc-200 py-6 text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors"
          >
            Click to upload a cover image
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
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
            placeholder="https://humanitix.com/…"
          />
        </div>
      )}

      <button
        onClick={createJam}
        disabled={busy}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create jam"}
      </button>

      {status && <p className="text-sm text-red-600">{status}</p>}
    </div>
  );
}
