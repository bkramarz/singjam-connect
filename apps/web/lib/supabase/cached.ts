import { cache } from "react";
import { supabaseServer } from "./server";

// React cache() memoizes per request, so layouts, pages and generateMetadata
// rendering in the same request share one client / one auth lookup.
export const getServerSupabase = cache(supabaseServer);

export const getServerUser = cache(async () => {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getServerUserRole = cache(async () => {
  const user = await getServerUser();
  if (!user) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role ?? null;
});
