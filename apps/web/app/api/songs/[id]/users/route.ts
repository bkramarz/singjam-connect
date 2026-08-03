import { NextResponse } from "next/server";
import { fetchSongJammers } from "@singjam/core";
import { requireAuth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  return NextResponse.json(await fetchSongJammers(auth.supabase, id));
}
