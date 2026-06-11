import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const { pathname } = request.nextUrl;
  const authRequired = ["/admin", "/notifications", "/profile", "/account"];
  const needsAuthCheck = authRequired.some((p) => pathname.startsWith(p));
  // Only call getUser() (a Supabase network round-trip) when the path requires
  // auth, or when the request already carries session cookies and needs refreshing.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  if (needsAuthCheck || hasAuthCookie) {
    // getClaims() refreshes the session like getUser(), but verifies the JWT
    // locally (no Supabase round trip) once the project uses asymmetric
    // signing keys. With legacy HS256 keys it falls back to getUser().
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims ?? null;

    if (!user && needsAuthCheck) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  // The leading $ excludes the home page: it serves identical anonymous
  // HTML from the CDN cache, and routing it through middleware forces an
  // edge-function cold start (~2s) in front of an otherwise-cached response.
  // Session cookie refresh for signed-in visitors happens client-side there.
  matcher: [
    "/((?!$|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
