import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import UserProfileContent from "@/components/UserProfileContent";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  // Service-role client: user_songs is not anon-readable, and the cookie-bound
  // client would force dynamic rendering. Only the aggregate count is exposed.
  const supabase = supabaseAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, neighborhood, singing_voice, user_songs(count)")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return { title: username };
  const p = profile as any;
  const songCount = p.user_songs?.[0]?.count ?? 0;
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
