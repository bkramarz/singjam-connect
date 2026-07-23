import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { flushEmailOutbox } from "../../lib/emailOutbox";

export const handler = schedule("*/10 * * * *", async () => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await flushEmailOutbox(admin, resend);
  } catch (err) {
    console.error("flush-email-outbox:", err);
    return { statusCode: 500 };
  }

  return { statusCode: 200 };
});
