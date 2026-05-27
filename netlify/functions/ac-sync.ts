import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { syncContact, ContactProfile } from "../../lib/activecampaign";

export const handler = schedule("0 3 * * *", async () => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [{ data: sbAuthData }, profilesResult] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("profiles").select("id,display_name,last_name,neighborhood,instrument_levels,favorite_genres,singing_voice"),
  ]);

  const users = sbAuthData?.users ?? [];
  const profileById = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );

  let synced = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;
    const p = profileById.get(user.id) ?? {} as Record<string, unknown>;
    const profile: ContactProfile = {
      firstName: (p.display_name as string) || undefined,
      lastName: (p.last_name as string) || undefined,
      neighborhood: (p.neighborhood as string) || undefined,
      singingVoice: (p.singing_voice as string)
        ? (p.singing_voice as string).split(",").map((s) => s.trim())
        : undefined,
      instrumentLevels: (p.instrument_levels as Record<string, string>) || undefined,
      favoriteGenres: (p.favorite_genres as string[]) || undefined,
    };
    try {
      await syncContact(user.email, profile);
      synced++;
    } catch {
      failed++;
    }
  }

  console.log(`[ac-sync] done: ${synced} synced, ${failed} failed`);
  return { statusCode: 200 };
});
