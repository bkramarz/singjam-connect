import { NextResponse } from "next/server";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";

export async function POST(req: Request) {
  const { description, steps, page } = await req.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const cookieClient = await supabaseServer();
  let user = (await cookieClient.auth.getUser()).data.user ?? null;
  let db = cookieClient;
  if (!user) {
    // Native app authenticates with a bearer token instead of cookies
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (bearer) {
      const bearerClient = supabaseFromBearer(bearer);
      user = (await bearerClient.auth.getUser()).data.user ?? null;
      if (user) db = bearerClient;
    }
  }

  let userInfo = "Not logged in";
  if (user) {
    const { data: profile } = await db
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();
    const name = (profile as any)?.display_name ?? (profile as any)?.username ?? "Unknown";
    userInfo = `${name} (${user.email})`;
  }

  const lines = [
    `<strong>From:</strong> ${userInfo}`,
    page ? `<strong>Page:</strong> ${page}` : null,
    `<strong>Description:</strong><br>${description.trim().replace(/\n/g, "<br>")}`,
    steps?.trim() ? `<strong>Steps to reproduce:</strong><br>${steps.trim().replace(/\n/g, "<br>")}` : null,
  ].filter(Boolean).join("<br><br>");

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: "music@singjam.org",
    subject: `Bug report from ${userInfo}`,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${lines}</div>`,
  });

  return NextResponse.json({ ok: true });
}
