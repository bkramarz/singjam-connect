import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionServer, supabaseServer } from "@/lib/supabase/server";
import JamRsvpButton from "@/components/JamRsvpButton";
import JamDeleteButton from "@/components/JamDeleteButton";

export default async function JamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const session = await getSessionServer();
  const userId = session?.user.id ?? null;

  const [jamRes, invitesRes] = await Promise.all([
    supabase
      .from("jams")
      .select("*, profiles(display_name, username)")
      .eq("id", id)
      .maybeSingle(),
    userId
      ? supabase
          .from("jam_invites")
          .select("invited_user_id, status, profiles(display_name, username)")
          .eq("jam_id", id)
          .eq("status", "accepted")
      : Promise.resolve({ data: [] }),
  ]);

  const jam = jamRes.data;
  if (!jam) notFound();

  const attendees = (invitesRes.data ?? []) as unknown as {
    invited_user_id: string;
    status: string;
    profiles: { display_name: string | null; username: string | null } | null;
  }[];

  const isHost = userId === jam.host_user_id;
  const isGoing = attendees.some((a) => a.invited_user_id === userId);

  const host = (jam as any).profiles as { display_name: string | null; username: string | null } | null;
  const hostLabel = host?.display_name ?? host?.username ?? "Someone";
  const hostHref = host?.username ? `/u/${host.username}` : null;

  const startsAt = jam.starts_at
    ? new Date(jam.starts_at).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-5 max-w-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{jam.jam_type}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Hosted by{" "}
            {hostHref ? (
              <Link href={hostHref} className="text-zinc-700 hover:text-amber-600">
                {hostLabel}
              </Link>
            ) : (
              <span className="text-zinc-700">{hostLabel}</span>
            )}
          </p>
        </div>
        {isHost && (
          <JamDeleteButton jamId={id} />
        )}
      </div>

      {/* Details card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
        {startsAt && (
          <div className="flex gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-zinc-400 uppercase tracking-wide pt-0.5">When</span>
            <span className="text-sm text-zinc-900">{startsAt}</span>
          </div>
        )}
        {!startsAt && (
          <div className="flex gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-zinc-400 uppercase tracking-wide pt-0.5">When</span>
            <span className="text-sm text-zinc-400">Date flexible — check notes</span>
          </div>
        )}
        <div className="flex gap-3">
          <span className="w-20 shrink-0 text-xs font-medium text-zinc-400 uppercase tracking-wide pt-0.5">Area</span>
          <span className="text-sm text-zinc-900">{jam.neighborhood ?? "—"}</span>
        </div>
        {jam.notes && (
          <div className="flex gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-zinc-400 uppercase tracking-wide pt-0.5">Notes</span>
            <span className="text-sm text-zinc-700 whitespace-pre-wrap">{jam.notes}</span>
          </div>
        )}
      </div>

      {/* RSVP / attendees */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-900">
              {attendees.length} {attendees.length === 1 ? "person" : "people"} going
            </div>
            {!userId && (
              <p className="mt-0.5 text-xs text-zinc-400">
                <Link href="/auth" className="underline">Sign in</Link> to RSVP
              </p>
            )}
          </div>
          {!isHost && (
            <JamRsvpButton jamId={id} userId={userId} initialRsvp={isGoing} />
          )}
        </div>

        {/* Attendee list — only visible to host */}
        {isHost && attendees.length > 0 && (
          <div className="border-t border-zinc-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Attendees</p>
            {attendees.map((a) => {
              const name = a.profiles?.display_name ?? a.profiles?.username ?? "Someone";
              const href = a.profiles?.username ? `/u/${a.profiles.username}` : null;
              return (
                <div key={a.invited_user_id} className="text-sm text-zinc-700">
                  {href ? (
                    <Link href={href} className="hover:text-amber-600">{name}</Link>
                  ) : name}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Link href="/jams" className="inline-block text-sm text-zinc-400 hover:text-zinc-600">
        ← All jams
      </Link>
    </div>
  );
}
