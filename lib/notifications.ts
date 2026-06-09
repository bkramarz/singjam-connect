import { supabaseAdmin } from "@/lib/supabase/admin";

export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const admin = supabaseAdmin();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
}
