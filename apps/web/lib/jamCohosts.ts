import type { SupabaseClient } from "@supabase/supabase-js";

export async function isJamCohost(admin: SupabaseClient, jamId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("jam_cohosts")
    .select("user_id")
    .eq("jam_id", jamId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}
