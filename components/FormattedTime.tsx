"use client";

export function FormattedTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...options })}
    </time>
  );
}

export function FormattedDate({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleDateString(undefined, options)}
    </time>
  );
}
