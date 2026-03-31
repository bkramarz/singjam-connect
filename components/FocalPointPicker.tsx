"use client";

import { useState, useRef, useEffect } from "react";

const FRAME_HEIGHT = 260;

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
  const imgRef = useRef<HTMLImageElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const [bounds, setBounds] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const [imgStyle, setImgStyle] = useState<React.CSSProperties>({ width: "100%" });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  function computeLayout(img: HTMLImageElement, containerW: number) {
    const containerRatio = containerW / FRAME_HEIGHT;
    const imageRatio = img.naturalWidth / img.naturalHeight;

    let displayW: number, displayH: number;
    if (imageRatio > containerRatio) {
      // Wider than frame — height fills, width overflows → pan horizontally
      displayH = FRAME_HEIGHT;
      displayW = img.naturalWidth * (FRAME_HEIGHT / img.naturalHeight);
      setImgStyle({ height: FRAME_HEIGHT, width: "auto" });
    } else {
      // Taller than frame — width fills, height overflows → pan vertically
      displayW = containerW;
      displayH = img.naturalHeight * (containerW / img.naturalWidth);
      setImgStyle({ width: "100%", height: "auto" });
    }

    const overflowX = Math.max(0, displayW - containerW);
    const overflowY = Math.max(0, displayH - FRAME_HEIGHT);
    const b = { minX: -overflowX, maxX: 0, minY: -overflowY, maxY: 0 };
    setBounds(b);

    // Convert stored focal point percentage to pixel offset
    const [xStr, yStr] = focalPoint.split(" ");
    const xPct = parseFloat(xStr) / 100;
    const yPct = parseFloat(yStr) / 100;
    const initial = {
      x: Math.max(b.minX, Math.min(b.maxX, -(xPct * overflowX))),
      y: Math.max(b.minY, Math.min(b.maxY, -(yPct * overflowY))),
    };
    offsetRef.current = initial;
    setOffset(initial);
  }

  function emitChange(newOffset: { x: number; y: number }, b: typeof bounds) {
    const overflowX = -b.minX;
    const overflowY = -b.minY;
    const xPct = overflowX > 0 ? Math.round((-newOffset.x / overflowX) * 100) : 50;
    const yPct = overflowY > 0 ? Math.round((-newOffset.y / overflowY) * 100) : 50;
    onChange(`${xPct}% ${yPct}%`);
  }

  function handleImageLoad() {
    const img = imgRef.current;
    const container = containerRef.current;
    if (img && container) computeLayout(img, container.clientWidth);
  }

  // Re-run layout when src changes
  useEffect(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (img?.complete && container) computeLayout(img, container.clientWidth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function applyDelta(dx: number, dy: number) {
    const next = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, offsetRef.current.x + dx)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, offsetRef.current.y + dy)),
    };
    offsetRef.current = next;
    setOffset(next);
    emitChange(next, bounds);
  }

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return;
    applyDelta(e.clientX - lastPos.current.x, e.clientY - lastPos.current.y);
    lastPos.current = { x: e.clientX, y: e.clientY };
  }

  function onMouseUp() { isDragging.current = false; }

  function onTouchStart(e: React.TouchEvent) {
    isDragging.current = true;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    applyDelta(e.touches[0].clientX - lastPos.current.x, e.touches[0].clientY - lastPos.current.y);
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-zinc-500">Drag to reposition the image within the frame.</p>
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { isDragging.current = false; }}
        className="relative overflow-hidden rounded-2xl select-none ring-2 ring-amber-400/40 active:cursor-grabbing cursor-grab"
        style={{ height: FRAME_HEIGHT }}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={handleImageLoad}
          draggable={false}
          className="absolute"
          style={{ ...imgStyle, top: offset.y, left: offset.x }}
        />
      </div>
    </div>
  );
}
