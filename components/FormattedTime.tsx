"use client";

export function FormattedTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  return (
    <>{new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...options })}</>
  );
}

export function FormattedDate({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  return (
    <>{new Date(iso).toLocaleDateString(undefined, options)}</>
  );
}
