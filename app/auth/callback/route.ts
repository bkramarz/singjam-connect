import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "";
  const next = /^\/[^/]/.test(rawNext) ? rawNext : null;

  if (code) {
    const cookieStore = await cookies();

    // Build the redirect response first so we can set cookies directly on it.
    // This is required in production — cookies set via cookieStore.set() are not
    // reliably forwarded when a separate NextResponse.redirect() is returned.
    const tempRedirect = NextResponse.redirect(`${origin}/account`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              tempRedirect.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(error.message)}`
      );
    }

    // Determine where to send the user
    let destination = next;
    if (!destination && sessionData?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", sessionData.user.id)
        .single();
      destination = !profile?.display_name ? "/account" : "/repertoire";
    }
    destination = destination ?? "/account";

    // Return the redirect with session cookies attached
    const response = NextResponse.redirect(`${origin}${destination}`);
    tempRedirect.cookies.getAll().forEach(({ name, value, ...options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  return NextResponse.redirect(`${origin}${next ?? "/account"}`);
}
