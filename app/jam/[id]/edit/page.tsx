import { supabaseServer } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import EditJamForm from "@/components/EditJamForm";

export default async function EditJamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [jamRes, genresRes, themesRes] = await Promise.all([
    supabase
      .from("jams")
      .select("id, name, visibility, starts_at, ends_at, neighborhood, full_address, notes, tickets_url, image_url, image_focal_point, capacity, host_user_id, guests_can_invite")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("jam_genres").select("genre_id").eq("jam_id", id),
    supabase.from("jam_themes").select("theme_id").eq("jam_id", id),
  ]);

  const jam = jamRes.data;
  if (!jam) notFound();
  if ((jam as any).host_user_id !== user.id) notFound();

  const selectedGenreIds = ((genresRes.data ?? []) as any[]).map((r) => r.genre_id as string);
  const selectedThemeIds = ((themesRes.data ?? []) as any[]).map((r) => r.theme_id as string);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit jam</h1>
      <EditJamForm jam={jam as any} selectedGenreIds={selectedGenreIds} selectedThemeIds={selectedThemeIds} />
    </div>
  );
}
