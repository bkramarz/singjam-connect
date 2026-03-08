"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const INSTRUMENTS = ["Vocals", "Guitar", "Ukulele", "Piano/Keys", "Bass", "Percussion", "Other"];
const ROLES = ["Lead vocal", "Harmony", "Chords", "Bassline", "Percussion groove", "Facilitator/leader"];
const VIBES = ["Living-room friendly", "Family-friendly", "Spiritual", "Secular", "Upbeat", "Reflective", "Improvisational", "Structured setlist"];

type Profile = {
  id: string;
  display_name: string | null;
  neighborhood: string | null;
  instruments: string[] | null;
  roles: string[] | null;
  comfort_level: "Beginner" | "Comfortable" | "Strong" | "Leader" | null;
  vibes: string[] | null;
};

export default function OnboardingForm({ initialProfile }: { initialProfile: Profile | null }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [name, setName] = useState(initialProfile?.display_name ?? "");
  const [neighborhood, setNeighborhood] = useState(initialProfile?.neighborhood ?? "Berkeley");
  const [instruments, setInstruments] = useState<string[]>(initialProfile?.instruments ?? ["Vocals"]);
  const [roles, setRoles] = useState<string[]>(initialProfile?.roles ?? ["Harmony"]);
  const [comfort, setComfort] = useState<Profile["comfort_level"]>(initialProfile?.comfort_level ?? "Comfortable");
  const [vibes, setVibes] = useState<string[]>(initialProfile?.vibes ?? ["Living-room friendly"]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function toggle(arr: string[], v: string) {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function save() {
    setBusy(true);
    setStatus(null);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setBusy(false);
      setStatus("Not signed in.");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: uid,
      display_name: name || null,
      neighborhood: neighborhood || null,
      instruments,
      roles,
      comfort_level: comfort,
      vibes,
      updated_at: new Date().toISOString(),
    });

    setBusy(false);
    setStatus(error ? error.message : "Saved!");
    if (!error) router.push("/repertoire");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-5">
      <div>
        <label className="block text-sm font-medium">First name</label>
        <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ben" />
      </div>

      <div>
        <label className="block text-sm font-medium">Neighborhood / city</label>
        <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Berkeley" />
        <div className="mt-1 text-xs text-zinc-500">We only show neighborhood-level info until an invite is accepted.</div>
      </div>

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

      <div>
        <label className="block text-sm font-medium">Comfort level</label>
        <select className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" value={comfort ?? "Comfortable"} onChange={(e) => setComfort(e.target.value as any)}>
          {["Beginner", "Comfortable", "Strong", "Leader"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

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

      <button onClick={save} disabled={busy}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
        {busy ? "Saving..." : "Save & continue"}
      </button>
      {status && <div className="text-sm text-zinc-600">{status}</div>}
    </div>
  );
}
