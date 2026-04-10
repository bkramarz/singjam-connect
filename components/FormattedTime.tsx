"use client";

import { useState, useEffect } from "react";

export function FormattedTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...options }));
  }, [iso]);

  if (!text) return null;
  return <time dateTime={iso}>{text}</time>;
}

export function FormattedDate({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(new Date(iso).toLocaleDateString(undefined, options));
  }, [iso]);

  if (!text) return null;
  return <time dateTime={iso}>{text}</time>;
}
