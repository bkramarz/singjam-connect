import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const { access_token } = await res.json();
    return access_token ?? null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
