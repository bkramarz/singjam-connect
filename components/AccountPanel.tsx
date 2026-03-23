"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";

const INSTRUMENTS = ["Vocals", "Guitar", "Ukulele", "Piano/Keys", "Bass", "Percussion", "Other"];
const ROLES = ["Lead vocal", "Harmony", "Chords", "Bassline", "Percussion groove", "Facilitator/leader"];
const VIBES = ["Living-room friendly", "Family-friendly", "Spiritual", "Secular", "Upbeat", "Reflective", "Improvisational", "Structured setlist"];
const RESERVED = new Set(["admin", "support", "help", "singjam", "sing", "jam", "connect", "api", "www", "mail"]);
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Profile = {
  display_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  neighborhood: string | null;
  instruments: string[] | null;
  roles: string[] | null;
  comfort_level: "Beginner" | "Comfortable" | "Strong" | "Leader" | null;
  vibes: string[] | null;
};

function toggle(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function suggestUsername(email: string): string {
  const prefix = email.split("@")[0] ?? "";
  const clean = prefix.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return USERNAME_RE.test(clean) && !RESERVED.has(clean) ? clean : "";
}

export default function AccountPanel() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [comfort, setComfort] = useState<Profile["comfort_level"]>("Comfortable");
  const [vibes, setVibes] = useState<string[]>([]);

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const usernameTimerRef = useRef<number | null>(null);
  const originalUsername = useRef<string>("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      supabase
        .from("profiles")
        .select("display_name, last_name, username, avatar_url, neighborhood, instruments, roles, comfort_level, vibes")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            setName(profile.display_name ?? "");
            setLastName(profile.last_name ?? "");
            setAvatarUrl(profile.avatar_url ?? null);
            setNeighborhood(profile.neighborhood ?? "");
            setInstruments(profile.instruments ?? []);
            setRoles(profile.roles ?? []);
            setComfort(profile.comfort_level ?? "Comfortable");
            setVibes(profile.vibes ?? []);

            const savedUsername = profile.username ?? "";
            if (savedUsername) {
              setUsername(savedUsername);
              originalUsername.current = savedUsername;
            } else if (data.user.email) {
              setUsername(suggestUsername(data.user.email));
            }
          }
          setLoading(false);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUsernameChange(val: string) {
    const lower = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(lower);

    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    if (!lower || lower === originalUsername.current) {
      setUsernameStatus("idle");
      return;
    }

    if (!USERNAME_RE.test(lower) || RESERVED.has(lower)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    usernameTimerRef.current = window.setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", lower)
        .neq("id", userId ?? "")
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 400);
  }

  async function uploadAvatar(file: File) {
    if (!userId) return;

    if (file.size > 5 * 1024 * 1024) {
      setStatus("Avatar must be under 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setStatus("Avatar upload failed: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (updateError) {
      setStatus("Failed to save avatar.");
    } else {
      setAvatarUrl(publicUrl + `?t=${Date.now()}`);
      window.dispatchEvent(new CustomEvent("profile-updated"));
    }
    setUploadingAvatar(false);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAvatar(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) uploadAvatar(file);
  }

  async function save() {
    if (usernameStatus === "taken" || usernameStatus === "invalid") {
      setStatus("Please fix your username before saving.");
      return;
    }

    setBusy(true);
    setStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setBusy(false); setStatus("Not signed in."); return; }

    const { error } = await supabase.from("profiles").upsert({
      id: uid,
      display_name: name || null,
      last_name: lastName || null,
      username: username || null,
      neighborhood: neighborhood || null,
      instruments,
      roles,
      comfort_level: comfort,
      vibes,
      updated_at: new Date().toISOString(),
    });

    setBusy(false);
    if (!error) {
      originalUsername.current = username;
      setUsernameStatus("idle");
    }
    setStatus(error ? error.message : "Saved!");
  }

  async function changeEmail() {
    if (!newEmail.trim()) return;
    setEmailBusy(true);
    setEmailStatus(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailBusy(false);
    if (error) {
      setEmailStatus(error.message);
    } else {
      setEmailStatus(`Confirmation sent to ${newEmail.trim()}. Click the link to complete the change.`);
      setChangingEmail(false);
      setNewEmail("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function deleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setStatus(body.error ?? "Failed to delete account.");
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return <div className="text-sm text-zinc-500">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-5">

        {/* Avatar */}
        <div
          className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-3 transition-colors ${draggingOver ? "border-amber-400 bg-amber-50" : "border-transparent"}`}
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 hover:opacity-80 transition-opacity"
            title="Change photo"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl text-zinc-400">
                {name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            {uploadingAvatar && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                Uploading…
              </span>
            )}
          </button>
          <div>
            <div className="text-sm font-medium">Profile photo</div>
            <div className="text-xs text-zinc-500">Click to upload or drag and drop · JPG, PNG, WebP · max 5 MB</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Email */}
        {email && (
          <div>
            <label className="block text-sm font-medium">Email</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">{email}</div>
              <button
                type="button"
                onClick={() => { setChangingEmail((v) => !v); setEmailStatus(null); setNewEmail(""); }}
                className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50"
              >
                Change
              </button>
            </div>
            {changingEmail && (
              <div className="mt-2 space-y-2">
                <input
                  type="email"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={changeEmail}
                    disabled={!newEmail.trim() || emailBusy}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {emailBusy ? "Sending…" : "Send confirmation"}
                  </button>
                  <button
                    onClick={() => { setChangingEmail(false); setNewEmail(""); setEmailStatus(null); }}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {emailStatus && <div className="mt-1 text-xs text-zinc-500">{emailStatus}</div>}
          </div>
        )}

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">First name</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ben"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Last name</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Kramarz"
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium">Username</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">@</span>
            <input
              className="w-full rounded-xl border border-zinc-300 pl-7 pr-8 py-2 text-sm"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="jamfan"
              maxLength={20}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
              {usernameStatus === "checking" && <span className="text-zinc-400">…</span>}
              {usernameStatus === "available" && <span className="text-emerald-500">✓</span>}
              {(usernameStatus === "taken" || usernameStatus === "invalid") && <span className="text-red-500">✗</span>}
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {usernameStatus === "invalid"
              ? "3–20 characters, letters, numbers and underscores only."
              : usernameStatus === "taken"
              ? "That username is already taken."
              : "3–20 characters · letters, numbers, underscores"}
          </div>
        </div>

        {/* Neighborhood */}
        <div>
          <label className="block text-sm font-medium">Neighborhood / city</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Berkeley"
          />
          <div className="mt-1 text-xs text-zinc-500">We only show neighborhood-level info until an invite is accepted.</div>
        </div>

        {/* Instruments */}
        <div>
          <div className="text-sm font-medium">Instruments</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {INSTRUMENTS.map((v) => (
              <button key={v} type="button" onClick={() => setInstruments(toggle(instruments, v))}
                className={`rounded-xl border px-3 py-1.5 text-sm ${instruments.includes(v) ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 hover:bg-zinc-50"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Roles */}
        <div>
          <div className="text-sm font-medium">Roles</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((v) => (
              <button key={v} type="button" onClick={() => setRoles(toggle(roles, v))}
                className={`rounded-xl border px-3 py-1.5 text-sm ${roles.includes(v) ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 hover:bg-zinc-50"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Comfort level */}
        <div>
          <label className="block text-sm font-medium">Comfort level</label>
          <select
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={comfort ?? "Comfortable"}
            onChange={(e) => setComfort(e.target.value as Profile["comfort_level"])}
          >
            {["Beginner", "Comfortable", "Strong", "Leader"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Vibe */}
        <div>
          <div className="text-sm font-medium">Vibe</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button key={v} type="button" onClick={() => setVibes(toggle(vibes, v))}
                className={`rounded-xl border px-3 py-1.5 text-sm ${vibes.includes(v) ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 hover:bg-zinc-50"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {status && <div className="text-sm text-zinc-600">{status}</div>}
      </div>

      {/* Sign out */}
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
        <button onClick={signOut} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50">
          Sign out
        </button>
      </div>

      {/* Delete account */}
      <div className="rounded-2xl border border-red-200 p-5 shadow-sm">
        <div className="text-sm font-medium text-red-700">Delete account</div>
        <div className="mt-1 text-xs text-zinc-500">
          Permanently deletes your account and all your data. This cannot be undone.
        </div>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-zinc-600">Type <strong>DELETE</strong> to confirm:</div>
            <input
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
