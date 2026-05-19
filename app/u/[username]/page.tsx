import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import UserProfileContent from "@/components/UserProfileContent";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, neighborhood, singing_voice")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return { title: username };
  const p = profile as any;
  const { count: songCount } = await supabase
    .from("user_songs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", p.id);
  const name = p.display_name ?? username;
  const parts = [p.singing_voice ?? null, p.neighborhood ?? null].filter(Boolean);
  const description = [
    parts.length ? `${parts.join(", ")}.` : null,
    (songCount ?? 0) > 0 ? `${songCount} song${songCount === 1 ? "" : "s"} in their repertoire.` : null,
    "Connect and jam together on SingJam.",
  ].filter(Boolean).join(" ");
  return {
    title: name,
    description,
    openGraph: { title: `${name} on SingJam`, description },
  };
}

export default function UserProfilePage() {
  return <UserProfileContent />;
}
