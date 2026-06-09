import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const token = await getSpotifyToken();
  if (!token) return NextResponse.json({ spotify_url: null });

  try {
    const q = artist ? `track:${title} artist:${artist}` : `track:${title}`;
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return NextResponse.json({ spotify_url: null });
    const data = await res.json();
    const spotify_url = (data.tracks?.items?.[0]?.external_urls?.spotify as string) ?? null;
    return NextResponse.json({ spotify_url });
  } catch {
    return NextResponse.json({ spotify_url: null });
  }
}
