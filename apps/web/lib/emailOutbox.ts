import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { welcomeEmailHtml } from "@/emails/welcome";

const FROM_ADDRESS = "SingJam <hello@singjam.org>";
const MAX_ATTEMPTS = 5;

export const EMAIL_WELCOME = "welcome";

type OutboxRow = {
  id: string;
  type: string;
  recipient: string;
  payload: { username?: string | null } | null;
  attempts: number;
};

const OUTBOX_COLS = "id, type, recipient, payload, attempts";

function renderEmail(row: OutboxRow): { subject: string; html: string } {
  switch (row.type) {
    case EMAIL_WELCOME:
      return {
        subject: "Welcome to SingJam",
        html: welcomeEmailHtml({ username: row.payload?.username ?? undefined }),
      };
    default:
      throw new Error(`Unknown email type: ${row.type}`);
  }
}

// Send one outbox row and record the outcome. The Resend SDK returns
// { error } rather than throwing on API errors, so we check both that and any
// thrown network error. Returns true only when the send succeeded.
async function deliver(admin: SupabaseClient, resend: Resend, row: OutboxRow): Promise<boolean> {
  const attempts = row.attempts + 1;
  const now = new Date().toISOString();
  try {
    const { subject, html } = renderEmail(row);
    const { error } = await resend.emails.send({ from: FROM_ADDRESS, to: row.recipient, subject, html });
    if (error) throw new Error(error.message ?? "Resend send error");

    await admin
      .from("email_outbox")
      .update({ status: "sent", attempts, sent_at: now, updated_at: now, last_error: null })
      .eq("id", row.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("email_outbox")
      .update({
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        last_error: message.slice(0, 500),
        updated_at: now,
      })
      .eq("id", row.id);
    console.error(`[emailOutbox] send failed for ${row.recipient} (type=${row.type}, attempt ${attempts}): ${message}`);
    return false;
  }
}

// Enqueue the welcome email idempotently, then attempt an immediate send so the
// happy path still delivers instantly. The unique (user_id, type) index means a
// second call for the same user is a no-op — the scheduled flush retries any
// row whose immediate send failed.
export async function enqueueWelcomeEmail(
  admin: SupabaseClient,
  resend: Resend,
  opts: { userId: string; email: string; username?: string },
): Promise<void> {
  const { data: rows, error } = await admin
    .from("email_outbox")
    .upsert(
      {
        user_id: opts.userId,
        type: EMAIL_WELCOME,
        recipient: opts.email,
        payload: { username: opts.username ?? null },
      },
      { onConflict: "user_id,type", ignoreDuplicates: true },
    )
    .select(OUTBOX_COLS);

  if (error) {
    console.error(`[emailOutbox] enqueue failed for ${opts.email}: ${error.message}`);
    return;
  }
  const row = rows?.[0] as OutboxRow | undefined;
  if (!row) return; // Already enqueued/sent for this user — idempotent no-op.
  await deliver(admin, resend, row);
}

// Retry sweeper: send everything still pending under the attempt cap. Invoked
// by the scheduled flush-email-outbox function.
export async function flushEmailOutbox(
  admin: SupabaseClient,
  resend: Resend,
): Promise<{ sent: number; failed: number }> {
  const { data: rows, error } = await admin
    .from("email_outbox")
    .select(OUTBOX_COLS)
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error(`[emailOutbox] flush query failed: ${error.message}`);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const row of (rows ?? []) as OutboxRow[]) {
    if (await deliver(admin, resend, row)) sent++;
    else failed++;
  }
  return { sent, failed };
}
