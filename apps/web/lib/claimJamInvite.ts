import { supabaseAdmin } from "@/lib/supabase/admin";

// Binds an unclaimed invite token to a user. Shared by the jam page (which
// claims on arrival) and /api/invite/claim (which the auth flow calls when the
// token isn't in the URL yet) so the rules live in one place.
//
// Claiming no longer gates *viewing* a jam — a private jam is unlisted, not
// access-controlled (migration 160). It records that this guest came in on the
// host's invite, which is what drives the host's invite list, the notification,
// and the accept/decline banner.
export async function claimJamInvite(token: string, userId: string): Promise<string | null> {
  const admin = supabaseAdmin();

  const { data: invite } = await admin
    .from("jam_invites")
    .select("id, jam_id, invited_user_id")
    .eq("token", token)
    .maybeSingle();

  if (!invite?.jam_id) return null;
  // Already bound — to this user or to whoever the host sent it to. Never
  // reassign: that would corrupt the original invitee's accept/decline state.
  if (invite.invited_user_id) return invite.jam_id;

  const { data: jam } = await admin
    .from("jams")
    .select("host_user_id")
    .eq("id", invite.jam_id)
    .maybeSingle();

  // A host can't be "invited" to their own jam — opening their own shareable
  // link (e.g. to preview it) shouldn't claim it for their account.
  if (jam?.host_user_id === userId) return invite.jam_id;

  // jam_invites has a unique index on (jam_id, invited_user_id); if this user
  // already has a row for the jam, binding a second one would fail.
  const { data: existing } = await admin
    .from("jam_invites")
    .select("id")
    .eq("jam_id", invite.jam_id)
    .eq("invited_user_id", userId)
    .maybeSingle();

  if (!existing) {
    await admin
      .from("jam_invites")
      .update({ invited_user_id: userId })
      .eq("id", invite.id)
      .is("invited_user_id", null);
  }

  return invite.jam_id;
}
