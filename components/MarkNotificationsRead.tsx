"use client";

import { useEffect } from "react";

export default function MarkNotificationsRead() {
  useEffect(() => {
    fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
