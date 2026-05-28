"use client";

import { useState, useEffect } from "react";

export function FormattedTime({
  iso,
  timezone,
  options,
}: {
  iso: string;
  timezone?: string | null;
  options?: Intl.DateTimeFormatOptions;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const tz = timezone ?? undefined;
    setText(
      new Date(iso).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        ...(tz ? { timeZone: tz, timeZoneName: "short" } : {}),
        ...options,
      })
    );
  }, [iso, timezone]);

  if (!text) return null;
  return <time dateTime={iso}>{text}</time>;
}

export function FormattedDate({
  iso,
  timezone,
  options,
}: {
  iso: string;
  timezone?: string | null;
  options?: Intl.DateTimeFormatOptions;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const tz = timezone ?? undefined;
    setText(
      new Date(iso).toLocaleDateString(undefined, {
        ...(tz ? { timeZone: tz } : {}),
        ...options,
      })
    );
  }, [iso, timezone]);

  if (!text) return null;
  return <time dateTime={iso}>{text}</time>;
}
