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
  const query = supabase.from("songs").select("title");
  const { data } = await (isUuid ? query.eq("id", slug) : query.or(`slug.eq.${slug},former_slug.eq.${slug}`)).single();
  return { title: data?.title ?? "Song" };
}

export default function SongPage() {
  return <SongPageContent />;
}
