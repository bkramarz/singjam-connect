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

function NotificationItem({ n }: { n: { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string } }) {
  const inner = (
    <div className={`flex items-start gap-3 px-4 py-3.5 ${!n.read ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-zinc-50"} transition-colors`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.read ? "bg-amber-500" : "bg-transparent"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!n.read ? "font-medium text-zinc-900" : "text-zinc-700"}`}>{n.title}</p>
        {n.body && <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>}
        <p className="text-xs text-zinc-400 mt-1">{timeAgo(n.created_at)}</p>
      </div>
    </div>
  );

  if (n.link) {
    return (
      <Link href={n.link} className="block no-underline">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function NotificationGroup({ items, label }: { items: any[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</h2>
      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {items.map((n: any) => <NotificationItem key={n.id} n={n} />)}
      </div>
    </section>
  );
}

export default async function NotificationsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [, { data: unreadData }, { data: readData }] = await Promise.all([
    supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .eq("read", true)
      .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .eq("user_id", user.id)
      .eq("read", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .eq("user_id", user.id)
      .eq("read", true)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const unread = unreadData ?? [];
  const read = readData ?? [];
  const items = [...unread, ...read];

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-xl font-semibold">Notifications</h1>

      <MarkNotificationsRead />

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No notifications yet.</p>
      ) : (
        <>
          <NotificationGroup items={unread} label="New" />
          <NotificationGroup items={read} label="Earlier" />
        </>
      )}
    </div>
  );
}
