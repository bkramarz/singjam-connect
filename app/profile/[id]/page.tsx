import { supabaseServer } from "@/lib/supabase/server";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{p?.display_name ?? "Profile"}</h1>
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-2">
        <div className="text-sm text-zinc-600">Neighborhood: <span className="text-zinc-900">{p?.neighborhood ?? "Bay Area"}</span></div>
        <div className="text-sm text-zinc-600">Instruments: <span className="text-zinc-900">{(p?.instruments ?? []).join(", ")}</span></div>
        <div className="text-sm text-zinc-600">Roles: <span className="text-zinc-900">{(p?.roles ?? []).join(", ")}</span></div>
        <div className="text-sm text-zinc-600">Vibe: <span className="text-zinc-900">{(p?.vibes ?? []).join(", ")}</span></div>
      </div>
      <div className="text-sm text-zinc-600">
        Shared repertoire details can be shown here next (RPC: shared_songs_with).
      </div>
    </div>
  );
}
