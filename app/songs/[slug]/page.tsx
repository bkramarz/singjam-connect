import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import SongPageContent from "@/components/SongPageContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await supabaseServer();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const query = supabase.from("songs").select("title, display_artist, first_line");
  const { data } = await (isUuid ? query.eq("id", slug) : query.or(`slug.eq.${slug},former_slug.eq.${slug}`)).single();
  if (!data) return { title: "Song" };
  const title = data.title;
  const artist = (data as any).display_artist;
  const firstLine = (data as any).first_line;
  const description = [
    artist ? `"${title}" by ${artist}.` : `"${title}".`,
    firstLine ? `Starts with: "${firstLine}".` : null,
    "Add it to your repertoire and find musicians to jam with on SingJam.",
  ].filter(Boolean).join(" ");
  return {
    title: artist ? `${title} — ${artist}` : title,
    description,
    openGraph: { title: artist ? `${title} — ${artist}` : title, description },
  };
}

export default function SongPage() {
  return <SongPageContent />;
}
