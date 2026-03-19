import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "";
  const next = /^\/[^/]/.test(rawNext) ? rawNext : "/onboarding";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
