import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

const INVALID_LINK_MESSAGE =
  "That password reset link is invalid or has expired. Please request a new one.";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? requestOrigin;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "";
  const next = /^\/[^/]/.test(rawNext) ? rawNext : "/auth/reset-password";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(INVALID_LINK_MESSAGE)}`
    );
  }

  const cookieStore = await cookies();

  // Build the redirect response first so we can set cookies directly on it.
  // This is required in production — cookies set via cookieStore.set() are not
  // reliably forwarded when a separate NextResponse.redirect() is returned.
  const response = NextResponse.redirect(`${origin}${next}`);

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
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(INVALID_LINK_MESSAGE)}`
    );
  }

  return response;
}
