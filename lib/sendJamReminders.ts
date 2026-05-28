import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { jamReminderHtml } from "../emails/jam-reminder";

const FROM_ADDRESS = "SingJam <hello@singjam.org>";

function localDateStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(date);
}

function localHour(date: Date, tz: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(date)
  );
}

function isJamTomorrow(now: Date, jamStartsAt: string, tz: string): boolean {
  const todayStr = localDateStr(now, tz);
  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  return localDateStr(new Date(jamStartsAt), tz) === tomorrowStr;
}

export async function sendJamReminders(admin: SupabaseClient, resend: Resend): Promise<number> {
  const now = new Date();

  // Broad window covers all timezones: 8 AM anywhere in the world is between
  // 10h and 60h before a jam happening "tomorrow" in that same timezone.
  const windowStart = new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 60 * 1000).toISOString();

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

  // Only send to jams where it is currently 8 AM in the jam's timezone
  // and the jam is happening tomorrow in that same timezone.
  const eligibleJams = (jams ?? []).filter((jam) => {
    if (!jam.starts_at) return false;
    const tz = jam.timezone ?? "UTC";
    return localHour(now, tz) === 8 && isJamTomorrow(now, jam.starts_at, tz);
  });

  if (eligibleJams.length === 0) return 0;

  let sent = 0;

  for (const jam of eligibleJams) {
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

    // Record before emailing so a transient email error doesn't trigger a re-send
    await admin.from("jam_reminders_sent").insert({ jam_id: jam.id, reminder_type: "24h" });

    // Collect unique user_ids: host + attending RSVPs + pending invites
    const userIdSet = new Set<string>();
    userIdSet.add(jam.host_user_id);
    for (const r of rsvps ?? []) userIdSet.add(r.user_id);
    for (const i of pendingInvites ?? []) userIdSet.add(i.invited_user_id);

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

    await Promise.all(
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

    sent += recipients.length;
  }

  return sent;
}
