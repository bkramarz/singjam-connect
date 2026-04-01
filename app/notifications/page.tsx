import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

export const metadata = { title: "Notifications" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function NotificationsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = notifications ?? [];

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
      </div>

      <MarkNotificationsRead />

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No notifications yet.</p>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          {items.map((n) => {
            const inner = (
              <div className={`flex items-start gap-3 px-4 py-3.5 ${!n.read ? "bg-amber-50" : "hover:bg-zinc-50"} transition-colors`}>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                )}
                <div className={`flex-1 min-w-0 ${n.read ? "pl-5" : ""}`}>
                  <p className="text-sm text-zinc-900">{n.title}</p>
                  {n.body && <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-zinc-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );

            if (n.link) {
              return (
                <Link key={n.id} href={n.link} className="block no-underline">
                  {inner}
                </Link>
              );
            }
            return <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
