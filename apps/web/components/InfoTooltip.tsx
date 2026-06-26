"use client";

import { useState, useRef, useEffect } from "react";
import React from "react";

export default function InfoTooltip({ text }: { text: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!locked) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setLocked(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [locked]);

  return (
    <span ref={ref} className="relative inline-flex items-center group">
      <button
        onClick={() => setLocked((l) => !l)}
        aria-label="More info"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-bold hover:bg-zinc-300 transition-colors select-none"
      >
        i
      </button>
      <span
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 w-56 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-white shadow-lg pointer-events-none ${
          locked ? "block" : "hidden group-hover:block"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
