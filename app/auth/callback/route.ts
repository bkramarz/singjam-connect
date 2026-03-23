import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "";
  const next = /^\/[^/]/.test(rawNext) ? rawNext : "/account";

  if (code) {
    const supabase = await supabaseServer();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(error.message)}`
      );
    }

    // If no explicit next param, decide based on whether the user is new
    if (!rawNext && sessionData?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", sessionData.user.id)
        .single();
      const isNewUser = !profile?.display_name;
      return NextResponse.redirect(`${origin}${isNewUser ? "/account" : "/repertoire"}`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
