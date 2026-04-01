"use client";

import { useEffect } from "react";

export default function MarkNotificationsRead() {
  useEffect(() => {
    fetch("/api/notifications/read", { method: "POST" })
      .then(() => window.dispatchEvent(new Event("notifications-read")))
      .catch(() => {});
  }, []);

  return null;
}
