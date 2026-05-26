import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { jamReminderHtml } from "../emails/jam-reminder";

const FROM_ADDRESS = "SingJam <hello@singjam.org>";

export async function sendJamReminders(admin: SupabaseClient, resend: Resend): Promise<number> {
  const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  const { data: jams, error } = await admin
    .from("jams")
    .select("id, name, starts_at, timezone, full_address, neighborhood")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .not("id", "in", `(select jam_id from jam_reminders_sent where reminder_type = '24h')`);

  if (error) {
    console.error("sendJamReminders: failed to fetch jams", error);
    throw error;
  }

  if (!jams || jams.length === 0) return 0;

  let sent = 0;

  for (const jam of jams) {
    const address = jam.full_address ?? jam.neighborhood ?? null;
    const jamUrl = `https://singjam.org/jam/${jam.id}`;

    const { data: rsvps } = await admin
      .from("jam_rsvps")
      .select("user_id")
      .eq("jam_id", jam.id)
      .eq("status", "attending");

    // Record before emailing so a transient email error doesn't trigger a re-send
    await admin.from("jam_reminders_sent").insert({ jam_id: jam.id, reminder_type: "24h" });

    if (!rsvps || rsvps.length === 0) continue;

    const profilesAndEmails = await Promise.all(
      rsvps.map(async ({ user_id }: { user_id: string }) => {
        const [{ data: profile }, { data: authData }] = await Promise.all([
          admin.from("profiles").select("display_name, username").eq("id", user_id).single(),
          (admin.auth as any).admin.getUserById(user_id),
        ]);
        return {
          email: authData?.user?.email ?? null,
          name: (profile as any)?.display_name ?? (profile as any)?.username ?? null,
        };
      })
    );

    const recipients = profilesAndEmails.filter((r) => r.email !== null) as { email: string; name: string | null }[];

    await Promise.all(
      recipients.map((r) =>
        resend.emails.send({
          from: FROM_ADDRESS,
          to: r.email,
          subject: `Reminder: ${jam.name ?? "Your jam"} is tomorrow`,
          html: jamReminderHtml({
            name: r.name,
            jamName: jam.name ?? "Your jam",
            jamUrl,
            startsAt: jam.starts_at,
            timezone: jam.timezone,
            address,
          }),
        })
      )
    );

    sent += recipients.length;
  }

  return sent;
}
