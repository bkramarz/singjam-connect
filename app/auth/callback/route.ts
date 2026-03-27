import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resend, FROM_ADDRESS } from "@/lib/resend";
import { welcomeEmailHtml } from "@/emails/welcome";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? requestOrigin;
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
      const user = sessionData.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const isFirstLogin =
        !!user.created_at &&
        !!user.last_sign_in_at &&
        Math.abs(new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime()) < 10_000;

      if (!profile) {
        // New email/password user — create profile with a unique auto-generated username
        const emailLocal = (user.email ?? "")
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 15) || "singer";
        let username = "";
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = `${emailLocal}${Math.floor(1000 + Math.random() * 9000)}`;
          const { data: taken } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", candidate)
            .maybeSingle();
          if (!taken) { username = candidate; break; }
        }
        if (!username) username = `singer${Date.now()}`;
        await supabase.from("profiles").insert({ id: user.id, username });

        if (user.email) {
          resend.emails.send({
            from: FROM_ADDRESS,
            to: user.email,
            subject: "Welcome to SingJam",
            html: welcomeEmailHtml({ username }),
          }).catch(() => {});
        }

        destination = "/account";
      } else {
        if (isFirstLogin && user.email) {
          resend.emails.send({
            from: FROM_ADDRESS,
            to: user.email,
            subject: "Welcome to SingJam",
            html: welcomeEmailHtml({ username: profile.username ?? user.email }),
          }).catch(() => {});
        }

        destination = !profile.username ? "/account" : "/repertoire";
      }
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
