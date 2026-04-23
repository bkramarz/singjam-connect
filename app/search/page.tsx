import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import SongSearch from "@/components/SongSearch";
import SubmitSongForm from "@/components/SubmitSongForm";

export const metadata: Metadata = { title: "Song Search" };

export default async function SongsPage() {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();

  const [profileRes, repertoireRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("singing_voice").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("user_songs").select("song_id, confidence").eq("user_id", user.id)
      : Promise.resolve({ data: null }),
  ]);

  const singingVoice = (profileRes.data as any)?.singing_voice ?? null;
  const initialRepertoire = (repertoireRes.data ?? []) as { song_id: string; confidence: string }[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Song Library</h1>
      <p className="text-sm text-zinc-600">
        Search by title, recording artist, first line or composer.
      </p>
      <SongSearch singingVoice={singingVoice} initialRepertoire={initialRepertoire} />
      {user && <SubmitSongForm />}
    </div>
  );
}
