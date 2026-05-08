import { notFound } from "next/navigation";
import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import SetDetail from "@/components/SetDetail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("sets").select("name").eq("id", id).single();
  return { title: (data as any)?.name ?? "Set" };
}

export default async function SetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();

  const [setRes, songsRes, collabRes] = await Promise.all([
    supabase
      .from("sets")
      .select("id, name, description, owner_user_id, profiles(display_name, username)")
      .eq("id", id)
      .single(),
    supabase
      .from("set_songs")
      .select("id, song_id, position, songs(title, display_artist, slug)")
      .eq("set_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("set_collaborators")
      .select("id, user_id, status, profiles(display_name, username, avatar_url)")
      .eq("set_id", id)
      .eq("status", "accepted"),
  ]);

  if (!setRes.data) notFound();

  const set = setRes.data as any;
  const songs = (songsRes.data ?? []) as any[];
  const collaborators = (collabRes.data ?? []) as any[];

  const isOwner = user?.id === set.owner_user_id;
  const isCollaborator = collaborators.some((c: any) => c.user_id === user?.id);

  return (
    <Suspense>
      <SetDetail
        set={set}
        initialSongs={songs}
        collaborators={collaborators}
        currentUserId={user?.id ?? null}
        canEdit={isOwner || isCollaborator}
        isOwner={isOwner}
      />
    </Suspense>
  );
}
