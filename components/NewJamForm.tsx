"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { type LocationValue } from "./LocationAutocomplete";
import TagCombobox from "./TagCombobox";
import JamCard from "./JamCard";
import FocalPointPicker from "./FocalPointPicker";

type LookupItem = { id: string; name: string };

function Label({ text, required, optional }: { text: string; required?: boolean; optional?: boolean }) {
  return (
    <label className="block text-sm font-medium">
      {text}
      {required && <span className="ml-1 text-red-500">*</span>}
      {optional && <span className="ml-1.5 text-xs font-normal text-zinc-400">optional</span>}
    </label>
  );
}

export default function NewJamForm() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"community" | "private" | "official">("community");
  const [previewing, setPreviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [genres, setGenres] = useState<LookupItem[]>([]);
  const [themes, setThemes] = useState<LookupItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

  const [guestsCanInvite, setGuestsCanInvite] = useState(false);
  const [name, setName] = useState("");
  const [ticketsUrl, setTicketsUrl] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState<LocationValue>({ fullAddress: "", neighborhood: "" });
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [focalPoint, setFocalPoint] = useState("50% 50%");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const { data: p } = await supabase.from("profiles").select("is_admin, display_name, username").eq("id", uid).single();
        setIsAdmin(!!(p as any)?.is_admin);
        setDisplayName((p as any)?.display_name ?? (p as any)?.username ?? null);
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
    setImagePreview(file ? URL.createObjectURL(file) : null);
    setFocalPoint("50% 50%");
  }

  function toIso(d: string, t: string) {
    if (!d || !t) return null;
    return new Date(`${d}T${t}`).toISOString();
  }

  function validate() {
    const errs: string[] = [];
    if (!date) errs.push("Date is required.");
    if (!startTime) errs.push("Start time is required.");
    if (!location.fullAddress) errs.push("Location is required.");
    return errs;
  }

  function goToPreview() {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setPreviewing(true);
  }

  async function publish() {
    setBusy(true);
    setStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setBusy(false); setStatus("Not signed in."); return; }

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

    const defaultName = displayName ? `${displayName}'s jam` : "Community jam";
    const jamName = name.trim() || (visibility === "official" ? null : defaultName);

    const { data, error } = await supabase.from("jams").insert({
      host_user_id: uid,
      name: jamName,
      starts_at: toIso(date, startTime),
      ends_at: toIso(date, endTime),
      neighborhood: location.neighborhood || location.fullAddress || null,
      full_address: location.fullAddress || null,
      notes: description || null,
      visibility,
      guests_can_invite: (visibility === "private" || visibility === "community") ? guestsCanInvite : false,
      tickets_url: visibility === "official" && ticketsUrl ? ticketsUrl : null,
      image_url: imageUrl,
      image_focal_point: imageUrl ? focalPoint : null,
      capacity: capacity ? parseInt(capacity, 10) : null,
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

    fetch("/api/jam/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jamId }),
    }).catch(() => {});

    router.push(`/jam/${jamId}`);
  }

  const isOfficial = visibility === "official";

  const previewGenreNames = selectedGenres.map((id) => genres.find((g) => g.id === id)?.name).filter(Boolean) as string[];
  const previewThemeNames = selectedThemes.map((id) => themes.find((t) => t.id === id)?.name).filter(Boolean) as string[];
  const defaultName = displayName ? `${displayName}'s jam` : "Community jam";
  const previewName = name.trim() || (isOfficial ? null : defaultName);

  if (previewing) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This is a preview — your jam hasn't been published yet.
        </div>
        <JamCard
          jam={{
            name: previewName,
            visibility,
            starts_at: toIso(date, startTime),
            ends_at: toIso(date, endTime),
            neighborhood: location.neighborhood || location.fullAddress || null,
            full_address: location.fullAddress || null,
            notes: description || null,
            tickets_url: isOfficial && ticketsUrl ? ticketsUrl : null,
            image_url: imagePreview,
            image_focal_point: focalPoint,
            genres: previewGenreNames,
            themes: previewThemeNames,
            host: displayName,
            capacity: capacity ? parseInt(capacity, 10) : null,
            hasFullAccess: true, // show full address in preview
          }}
          actions={
            <div className="flex gap-3">
              <button
                onClick={() => setPreviewing(false)}
                className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                ← Edit
              </button>
              <button
                onClick={publish}
                disabled={busy}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {busy ? "Publishing…" : "Publish jam"}
              </button>
            </div>
          }
        />
        {status && <p className="text-sm text-red-600">{status}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-5">
      {/* Visibility */}
      <div>
        <Label text="Who can see this?" />
        <div className="mt-1.5 flex flex-col gap-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="visibility" value="community" checked={visibility === "community"} onChange={() => setVisibility("community")} className="mt-0.5" />
            <div>
              <span className="text-sm font-medium">Community jam</span>
              <p className="text-xs text-zinc-500">Visible to all SingJam members</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="visibility" value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} className="mt-0.5" />
            <div>
              <span className="text-sm font-medium">Private jam</span>
              <p className="text-xs text-zinc-500">Only visible to people you invite</p>
            </div>
          </label>
          {isAdmin && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="visibility" value="official" checked={visibility === "official"} onChange={() => setVisibility("official")} className="mt-0.5" />
              <div>
                <span className="text-sm font-medium text-amber-600">Official SingJam event</span>
                <p className="text-xs text-zinc-500">Public — visible to anyone on the site</p>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Guests can invite — private and community jams */}
      {(visibility === "private" || visibility === "community") && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={guestsCanInvite}
            onChange={(e) => setGuestsCanInvite(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <div>
            <span className="text-sm font-medium">Allow attendees to invite others</span>
            <p className="text-xs text-zinc-500">Guests can invite people directly from the jam page</p>
          </div>
        </label>
      )}

      {/* Name */}
      <div>
        <Label text="Event name" optional={!isOfficial} required={isOfficial} />
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isOfficial ? "e.g. SingJam Open Circle — April" : `Defaults to "${defaultName}"`}
        />
      </div>

      {/* Date and time */}
      <div className="space-y-2">
        <Label text="Date" required />
        <input
          className="w-full appearance-none rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Start time <span className="text-red-500">*</span>
            </label>
            <input className="w-full appearance-none rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              End time <span className="ml-1 text-xs font-normal text-zinc-400">optional</span>
            </label>
            <input className="w-full appearance-none rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <Label text={isOfficial ? "Venue / address" : "Location"} required />
        {!isOfficial && (
          <p className="text-xs text-zinc-400 mt-0.5 mb-1">Exact address is only shared with people who RSVP</p>
        )}
        <LocationAutocomplete
          value={location.fullAddress}
          onChange={setLocation}
          placeholder={isOfficial ? "e.g. Freight & Salvage, Berkeley" : "e.g. Cedar Rose Park, Berkeley"}
        />
      </div>

      {/* Capacity */}
      <div>
        <Label text="Capacity" optional />
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          type="number"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Leave blank for unlimited"
        />
      </div>

      <TagCombobox label="Genres" options={genres} selected={selectedGenres} onChange={setSelectedGenres} placeholder="Search genres…" optional />
      <TagCombobox label="Themes" options={themes} selected={selectedThemes} onChange={setSelectedThemes} placeholder="Search themes…" optional />

      {/* Description */}
      <div>
        <Label text="Description" optional />
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
        <Label text="Cover image" optional />
        <div className="mt-1 space-y-3">
          {imagePreview ? (
            <>
              <FocalPointPicker src={imagePreview} focalPoint={focalPoint} onChange={setFocalPoint} />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); setFocalPoint("50% 50%"); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Remove image
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-zinc-200 py-6 text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors"
            >
              Click to upload a cover image
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>
      </div>

      {isOfficial && (
        <div>
          <Label text="Tickets URL" optional />
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            type="url"
            value={ticketsUrl}
            onChange={(e) => setTicketsUrl(e.target.value)}
            placeholder="https://humanitix.com/…"
          />
        </div>
      )}

      {errors.length > 0 && (
        <ul className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
          {errors.map((e) => <li key={e} className="text-sm text-red-600">{e}</li>)}
        </ul>
      )}

      <button
        onClick={goToPreview}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
      >
        Preview
      </button>
    </div>
  );
}
