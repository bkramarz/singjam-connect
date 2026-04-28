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
  const { data } = await supabase.from("songs").select("title").eq(isUuid ? "id" : "slug", slug).single();
  return { title: data?.title ? `${data.title} — SingJam` : "Song — SingJam" };
}

export default function SongPage() {
  return <SongPageContent />;
}
