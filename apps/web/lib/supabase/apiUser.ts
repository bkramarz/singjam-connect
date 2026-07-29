import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFromBearer } from "@/lib/supabase/bearer";

// Resolves the authenticated user for an API route from either the cookie
// session (web) or an `Authorization: Bearer <token>` header (the native app).
// The cookie session is tried first, so existing web behavior is unchanged and
// bearer auth is a pure fallback.
export async function resolveApiUser(req: Request): Promise<User | null> {
  const cookieClient = await supabaseServer();
  const cookieUser = (await cookieClient.auth.getUser()).data.user;
  if (cookieUser) return cookieUser;

  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (bearer) {
    const bearerUser = (await supabaseFromBearer(bearer).auth.getUser()).data.user;
    if (bearerUser) return bearerUser;
  }
  return null;
}

// Same resolution as `resolveApiUser`, but also returns the RLS-scoped client the
// user was resolved from. Routes that read through RLS (rather than the admin
// client) need the *matching* client — a cookie route handed a bearer request
// would otherwise run its queries as the anon role and silently return nothing.
// `user` is null for anonymous callers; `db` is then the plain anon client.
export async function resolveApiClient(
  req: Request
): Promise<{ db: Awaited<ReturnType<typeof supabaseServer>>; user: User | null }> {
  const cookieClient = await supabaseServer();
  const cookieUser = (await cookieClient.auth.getUser()).data.user;
  if (cookieUser) return { db: cookieClient, user: cookieUser };

  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (bearer) {
    const bearerClient = supabaseFromBearer(bearer);
    const bearerUser = (await bearerClient.auth.getUser()).data.user;
    if (bearerUser) return { db: bearerClient as any, user: bearerUser };
  }
  return { db: cookieClient, user: null };
}
