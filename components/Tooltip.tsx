import type { ReactNode } from "react";

export default function Tooltip({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block">
        <div className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-white whitespace-nowrap shadow-lg">
          {message}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </div>
      </div>
    </div>
  );
}
