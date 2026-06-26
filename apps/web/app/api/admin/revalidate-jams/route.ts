import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  revalidateTag("upcoming-jams");
  return NextResponse.json({ ok: true });
}
