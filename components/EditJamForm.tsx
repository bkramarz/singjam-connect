"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { type LocationValue } from "./LocationAutocomplete";
import TagCombobox from "./TagCombobox";
import JamCard from "./JamCard";
import FocalPointPicker from "./FocalPointPicker";

type LookupItem = { id: string; name: string };

type JamData = {
  id: string;
  name: string | null;
  visibility: "community" | "private" | "official";
  starts_at: string | null;
  ends_at: string | null;
  neighborhood: string | null;
  full_address: string | null;
  notes: string | null;
  tickets_url: string | null;
  image_url: string | null;
  image_focal_point: string | null;
  capacity: number | null;
};

function Label({ text, required, optional }: { text: string; required?: boolean; optional?: boolean }) {
  return (
    <label className="block text-sm font-medium">
      {text}
      {required && <span className="ml-1 text-red-500">*</span>}
      {optional && <span className="ml-1.5 text-xs font-normal text-zinc-400">optional</span>}
    </label>
  );
}

function isoToDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function isoToTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toTimeString().slice(0, 5);
}

export default function EditJamForm({
  jam,
  selectedGenreIds,
  selectedThemeIds,
}: {
  jam: JamData;
  selectedGenreIds: string[];
  selectedThemeIds: string[];
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [visibility, setVisibility] = useState(jam.visibility);
  const [previewing, setPreviewing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [genres, setGenres] = useState<LookupItem[]>([]);
  const [themes, setThemes] = useState<LookupItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(selectedGenreIds);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(selectedThemeIds);

  const [name, setName] = useState(jam.name ?? "");
  const [ticketsUrl, setTicketsUrl] = useState(jam.tickets_url ?? "");
  const [date, setDate] = useState(isoToDate(jam.starts_at));
  const [startTime, setStartTime] = useState(isoToTime(jam.starts_at));
  const [endTime, setEndTime] = useState(isoToTime(jam.ends_at));
  const [location, setLocation] = useState<LocationValue>({
    fullAddress: jam.full_address ?? jam.neighborhood ?? "",
    neighborhood: jam.neighborhood ?? "",
  });
  const [capacity, setCapacity] = useState(jam.capacity?.toString() ?? "");
  const [description, setDescription] = useState(jam.notes ?? "");

  // Image state — start with existing image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(jam.image_url);
  const [focalPoint, setFocalPoint] = useState(jam.image_focal_point ?? "50% 50%");
  const [removeImage, setRemoveImage] = useState(false);
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
    setRemoveImage(false);
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

  async function save() {
    setBusy(true);
    setStatus(null);

    let imageUrl: string | null = removeImage ? null : (jam.image_url ?? null);
    let newFocalPoint: string | null = removeImage ? null : focalPoint;

    if (imageFile) {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setBusy(false); setStatus("Not signed in."); return; }
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
      newFocalPoint = focalPoint;
    }

    const isOfficial = visibility === "official";
    const defaultName = displayName ? `${displayName}'s jam` : "Community jam";
    const jamName = name.trim() || (isOfficial ? null : defaultName);

    const { error } = await supabase.from("jams").update({
      name: jamName,
      starts_at: toIso(date, startTime),
      ends_at: toIso(date, endTime),
      neighborhood: location.neighborhood || location.fullAddress || null,
      full_address: location.fullAddress || null,
      notes: description || null,
      visibility,
      tickets_url: isOfficial && ticketsUrl ? ticketsUrl : null,
      image_url: imageUrl,
      image_focal_point: newFocalPoint,
      capacity: capacity ? parseInt(capacity, 10) : null,
    }).eq("id", jam.id);

    if (error) {
      setBusy(false);
      setStatus(error.message);
      return;
    }

    // Sync genres: delete all, re-insert
    await supabase.from("jam_genres").delete().eq("jam_id", jam.id);
    await supabase.from("jam_themes").delete().eq("jam_id", jam.id);
    await Promise.all([
      selectedGenres.length > 0
        ? supabase.from("jam_genres").insert(selectedGenres.map((genre_id) => ({ jam_id: jam.id, genre_id })))
        : Promise.resolve(),
      selectedThemes.length > 0
        ? supabase.from("jam_themes").insert(selectedThemes.map((theme_id) => ({ jam_id: jam.id, theme_id })))
        : Promise.resolve(),
    ]);

    router.push(`/jam/${jam.id}`);
  }

  const isOfficial = visibility === "official";
  const previewGenreNames = selectedGenres.map((id) => genres.find((g) => g.id === id)?.name).filter(Boolean) as string[];
  const previewThemeNames = selectedThemes.map((id) => themes.find((t) => t.id === id)?.name).filter(Boolean) as string[];
  const defaultName = displayName ? `${displayName}'s jam` : "Community jam";
  const previewName = name.trim() || (isOfficial ? null : defaultName);
  const previewImageUrl = removeImage ? null : imagePreview;

  if (previewing) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Preview — changes haven't been saved yet.
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
            image_url: previewImageUrl,
            image_focal_point: focalPoint,
            genres: previewGenreNames,
            themes: previewThemeNames,
            host: displayName,
            capacity: capacity ? parseInt(capacity, 10) : null,
            hasFullAccess: true,
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
                onClick={save}
                disabled={busy}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {busy ? "Saving…" : "Save changes"}
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
        <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Start time <span className="text-red-500">*</span></label>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">End time <span className="ml-1 text-xs font-normal text-zinc-400">optional</span></label>
            <input className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <Label text={isOfficial ? "Venue / address" : "Location"} required />
        {!isOfficial && <p className="text-xs text-zinc-400 mt-0.5 mb-1">Exact address only shared with people who RSVP</p>}
        <LocationAutocomplete value={location.fullAddress} onChange={setLocation} placeholder={isOfficial ? "e.g. Freight & Salvage, Berkeley" : "e.g. Cedar Rose Park, Berkeley"} />
      </div>

      {/* Capacity */}
      <div>
        <Label text="Capacity" optional />
        <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Leave blank for unlimited" />
      </div>

      <TagCombobox label="Genres" options={genres} selected={selectedGenres} onChange={setSelectedGenres} placeholder="Search genres…" optional />
      <TagCombobox label="Themes" options={themes} selected={selectedThemes} onChange={setSelectedThemes} placeholder="Search themes…" optional />

      {/* Description */}
      <div>
        <Label text="Description" optional />
        <textarea className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vibe, what to bring, skill level, etc." />
      </div>

      {/* Image */}
      <div>
        <Label text="Cover image" optional />
        <div className="mt-1 space-y-3">
          {imagePreview && !removeImage ? (
            <>
              <FocalPointPicker src={imagePreview} focalPoint={focalPoint} onChange={setFocalPoint} />
              <div className="flex gap-4">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
                  Replace image
                </button>
                <button type="button" onClick={() => { setRemoveImage(true); setImagePreview(null); setImageFile(null); }} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                  Remove image
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-zinc-200 py-6 text-sm text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors">
              Click to upload a cover image
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>
      </div>

      {isOfficial && (
        <div>
          <Label text="Tickets URL" optional />
          <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" type="url" value={ticketsUrl} onChange={(e) => setTicketsUrl(e.target.value)} placeholder="https://humanitix.com/…" />
        </div>
      )}

      {errors.length > 0 && (
        <ul className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
          {errors.map((e) => <li key={e} className="text-sm text-red-600">{e}</li>)}
        </ul>
      )}

      <button onClick={goToPreview} className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
        Preview changes
      </button>
    </div>
  );
}
