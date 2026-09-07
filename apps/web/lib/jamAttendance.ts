import type { SupabaseClient } from "@supabase/supabase-js";

// Attending a jam has always meant two things at once: a row in jam_rsvps, and
// editor access to the jam's linked set so the person can add what they want to
// play. The RSVP button did both. The ticket webhook did only the first, which
// left buyers listed as going but unable to touch the set — the one thing they
// paid to take part in. Both paths call this so the pair cannot drift again.
//
// Idempotent: re-running for someone who already collaborates is a no-op, so a
// redelivered webhook or a repeat RSVP costs nothing.
export async function joinJamSetList(
  admin: SupabaseClient,
  jamId: string,
  userId: string,
): Promise<void> {
  const { data: linkedSet } = await admin
    .from("sets")
    .select("id, owner_user_id")
    .eq("jam_id", jamId)
    .maybeSingle();

  // No set yet is fine — linking one later back-fills every attendee.
  if (!linkedSet || linkedSet.owner_user_id === userId) return;

  const { data: existingCollab } = await admin
    .from("set_collaborators")
    .select("id")
    .eq("set_id", linkedSet.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCollab) return;

  // Role defaults to 'editor' (migration 088), which is what lets them add songs.
  await admin.from("set_collaborators").insert({
    set_id: linkedSet.id,
    user_id: userId,
    invited_by: linkedSet.owner_user_id,
    status: "accepted",
  });
}

// Marks a user as going and gives them the set-list seat that goes with it.
// The RSVP button can't use this as-is because it also has to weigh capacity
// and the waitlist; a paid ticket has already bought past both.
export async function markAttending(
  admin: SupabaseClient,
  jamId: string,
  userId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("jam_rsvps")
    .select("id")
    .eq("jam_id", jamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("jam_rsvps")
      .update({ status: "attending", waitlist_position: null })
      .eq("id", existing.id);
  } else {
    await admin.from("jam_rsvps").insert({
      jam_id: jamId,
      user_id: userId,
      status: "attending",
      waitlist_position: null,
    });
  }

  await joinJamSetList(admin, jamId, userId);
}
