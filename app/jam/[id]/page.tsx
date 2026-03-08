import { supabaseServer } from "@/lib/supabase/server";

export default async function JamPage({ params }: { params: { id: string } }) {
  const supabase = await supabaseServer();
  const { data: jam } = await supabase.from("jams").select("*").eq("id", params.id).maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Jam</h1>
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-2">
        <div className="text-sm text-zinc-600">Type: <span className="text-zinc-900">{jam?.jam_type ?? "-"}</span></div>
        <div className="text-sm text-zinc-600">When: <span className="text-zinc-900">{jam?.starts_at ? new Date(jam.starts_at).toLocaleString() : "TBD"}</span></div>
        <div className="text-sm text-zinc-600">Neighborhood: <span className="text-zinc-900">{jam?.neighborhood ?? "-"}</span></div>
        <div className="text-sm text-zinc-600">Notes: <span className="text-zinc-900">{jam?.notes ?? "—"}</span></div>
      </div>
      <div className="text-sm text-zinc-600">Next: add invited users, RSVP, and jam song list.</div>
    </div>
  );
}
