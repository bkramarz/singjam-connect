import type { Metadata } from "next";
import NotificationsList from "@/components/NotificationsList";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <NotificationsList />
    </div>
  );
}
