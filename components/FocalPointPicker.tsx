"use client";

import { useRef } from "react";

export default function FocalPointPicker({
  src,
  focalPoint,
  onChange,
}: {
  src: string;
  focalPoint: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onChange(`${x}% ${y}%`);
  }

  const [xStr, yStr] = focalPoint.split(" ");
  const x = parseFloat(xStr);
  const y = parseFloat(yStr);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-zinc-500">Click the image to set the focal point — this part will always be visible.</p>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative overflow-hidden rounded-2xl cursor-crosshair select-none"
        style={{ maxHeight: 280 }}
      >
        <img
          src={src}
          alt="Focal point"
          className="w-full object-cover"
          style={{ maxHeight: 280, objectPosition: focalPoint }}
          draggable={false}
        />
        {/* Focal point indicator */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg bg-white/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>
        <div className="absolute inset-0 ring-2 ring-inset ring-amber-400/40 rounded-2xl pointer-events-none" />
      </div>
    </div>
  );
}
