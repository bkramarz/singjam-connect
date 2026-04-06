import { supabaseServer } from "@/lib/supabase/server";

export async function getFeatureFlag(key: string): Promise<boolean> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  return data?.enabled ?? true;
}
