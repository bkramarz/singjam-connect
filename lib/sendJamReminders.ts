import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { jamReminderHtml } from "../emails/jam-reminder";

const FROM_ADDRESS = "SingJam <hello@singjam.org>";
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function sendJamReminders(admin: SupabaseClient, resend: Resend): Promise<number> {
  const now = new Date();

  // Send a reminder once a jam starts within the next 24 hours. Any hourly run
  // that finds an unsent jam still in this window sends it, so a missed or
  // failed run is retried on the next tick — the jam_reminders_sent unique row
  // dedupes so a jam is only ever reminded once.
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString();

  const { data: alreadySent } = await admin
    .from("jam_reminders_sent")
    .select("jam_id")
    .eq("reminder_type", "24h");

  const alreadySentIds = (alreadySent ?? []).map((r: { jam_id: string }) => r.jam_id);

  let jamsQuery = admin
    .from("jams")
    .select("id, name, starts_at, timezone, full_address, neighborhood, host_user_id")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);

  if (alreadySentIds.length > 0) {
    jamsQuery = jamsQuery.not("id", "in", `(${alreadySentIds.join(",")})`);
  }

  const { data: jams, error } = await jamsQuery;

  if (error) {
    console.error("sendJamReminders: failed to fetch jams", error);
    throw error;
  }

  const eligibleJams = (jams ?? []).filter((jam) => jam.starts_at);

  if (eligibleJams.length === 0) return 0;

  let sent = 0;

  for (const jam of eligibleJams) {
    // Isolate each jam so a failure on one doesn't abort reminders for the rest.
    try {
      const address = jam.full_address ?? jam.neighborhood ?? null;
      const jamUrl = `https://singjam.org/jam/${jam.id}`;
      const jamDay = new Date(jam.starts_at).toLocaleString("en-US", {
        timeZone: jam.timezone ?? undefined,
        weekday: "long",
      });

      const [{ data: rsvps }, { data: pendingInvites }] = await Promise.all([
        admin
          .from("jam_rsvps")
          .select("user_id")
          .eq("jam_id", jam.id)
          .eq("status", "attending"),
        admin
          .from("jam_invites")
          .select("invited_user_id")
          .eq("jam_id", jam.id)
          .eq("status", "pending"),
      ]);

      // Collect unique user_ids: host + attending RSVPs + pending invites.
      // Link invites have a null invited_user_id and must be skipped — passing
      // null to getUserById throws and would abort the whole send.
      const userIdSet = new Set<string>();
      if (jam.host_user_id) userIdSet.add(jam.host_user_id);
      for (const r of rsvps ?? []) if (r.user_id) userIdSet.add(r.user_id);
      for (const i of pendingInvites ?? []) if (i.invited_user_id) userIdSet.add(i.invited_user_id);

      const profilesAndEmails = await Promise.all(
        [...userIdSet].map(async (user_id) => {
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

      if (recipients.length === 0) {
        // Nothing to send; record so we don't reprocess this jam every hour.
        await admin.from("jam_reminders_sent").insert({ jam_id: jam.id, reminder_type: "24h" });
        continue;
      }

      const results = await Promise.allSettled(
        recipients.map((r) =>
          resend.emails.send({
            from: FROM_ADDRESS,
            to: r.email,
            subject: `Reminder: ${jam.name ?? "Your jam"} is tomorrow (${jamDay})`,
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

      results.forEach((res, i) => {
        if (res.status === "rejected") {
          console.error(`sendJamReminders: failed to email ${recipients[i].email} for jam ${jam.id}`, res.reason);
        }
      });

      const succeeded = results.filter((res) => res.status === "fulfilled").length;

      if (succeeded === 0) {
        // Every send failed (e.g. a Resend outage). Leave the jam unrecorded so
        // the next hourly run retries instead of silently dropping the reminder.
        console.error(`sendJamReminders: all sends failed for jam ${jam.id}; will retry next run`);
        continue;
      }

      // Record only after a successful send so a failed send is retried.
      await admin.from("jam_reminders_sent").insert({ jam_id: jam.id, reminder_type: "24h" });
      sent += succeeded;
    } catch (err) {
      console.error(`sendJamReminders: error processing jam ${jam.id}`, err);
    }
  }

  return sent;
}
