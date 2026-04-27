"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import MarkNotificationsRead from "@/components/MarkNotificationsRead";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationItem({ n }: { n: Notification }) {
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

  if (n.link) return <Link href={n.link} className="block no-underline">{inner}</Link>;
  return <div>{inner}</div>;
}

function NotificationGroup({ items, label }: { items: Notification[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</h2>
      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {items.map((n) => <NotificationItem key={n.id} n={n} />)}
      </div>
    </section>
  );
}

export default function NotificationsList() {
  const [unread, setUnread] = useState<Notification[] | null>(null);
  const [read, setRead] = useState<Notification[]>([]);
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [, { data: unreadData }, { data: readData }] = await Promise.all([
        supabase.from("notifications").delete().eq("user_id", userId).eq("read", true).lt("created_at", cutoff),
        supabase.from("notifications").select("id, title, body, link, read, created_at").eq("user_id", userId).eq("read", false).order("created_at", { ascending: false }),
        supabase.from("notifications").select("id, title, body, link, read, created_at").eq("user_id", userId).eq("read", true).order("created_at", { ascending: false }).limit(10),
      ]);

      setUnread((unreadData ?? []) as Notification[]);
      setRead((readData ?? []) as Notification[]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (unread === null) return null;

  const isEmpty = unread.length === 0 && read.length === 0;

  return (
    <div className="space-y-5">
      <MarkNotificationsRead />
      {isEmpty ? (
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
