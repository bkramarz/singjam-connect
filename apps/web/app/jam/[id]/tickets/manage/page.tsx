import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import TicketTierManager from "@/components/TicketTierManager";

// Ticket management lives per-event rather than under /admin: hosts own their
// own events, and routing this through site-admin would make one person a
// bottleneck for every gig. Co-hosts are included, matching the API.

export default async function ManageTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/jam/${id}/tickets/manage`)}`);

  const admin = supabaseAdmin();
  const { data: jam } = await admin
    .from("jams")
    .select("id, name, visibility, host_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!jam) notFound();

  let allowed = jam.host_user_id === user.id;
  if (!allowed) {
    const { data: cohost } = await admin
      .from("jam_cohosts")
      .select("id")
      .eq("jam_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    allowed = !!cohost;
  }
  // notFound rather than a 403 page — don't confirm the event exists to someone
  // who has no business managing it.
  if (!allowed) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/jam/${id}`} className="text-xs text-zinc-500 hover:text-zinc-700">
          ← {jam.name ?? "Back to jam"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900">Tickets</h1>
      </div>

      {jam.visibility !== "official" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This event isn&apos;t official yet, so tickets won&apos;t show on the event page. Change its
          visibility to Official in{" "}
          <Link href={`/jam/${id}/edit`} className="underline">
            edit
          </Link>{" "}
          to start selling.
        </p>
      )}

      <TicketTierManager jamId={id} />
    </div>
  );
}
