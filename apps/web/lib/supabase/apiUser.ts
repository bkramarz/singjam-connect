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
