import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const authRequired = ["/admin", "/notifications", "/profile", "/account"];

  // Skip the Supabase network call entirely if there is no auth cookie.
  // Unauthenticated requests have nothing to refresh, and calling getUser()
  // unconditionally forces a round-trip to Supabase on every page load,
  // causing a cold-connection delay after periods of inactivity.
  const hasSession = request.cookies.getAll().some(({ name }) =>
    /^sb-.+-auth-token/.test(name)
  );

  if (!hasSession) {
    if (authRequired.some((p) => pathname.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session token and writes updated cookies to the response.
  // Do not add logic between createServerClient and getUser.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && authRequired.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
