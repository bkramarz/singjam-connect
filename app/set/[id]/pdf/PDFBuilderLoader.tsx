"use client";

import dynamic from "next/dynamic";
import type { PDFSong } from "./PDFBuilder";

// @react-pdf/renderer uses browser APIs — must be loaded client-side only
const PDFBuilder = dynamic(() => import("./PDFBuilder"), { ssr: false });

export default function PDFBuilderLoader({
  setName,
  songs,
}: {
  setName: string;
  songs: PDFSong[];
}) {
  return <PDFBuilder setName={setName} songs={songs} />;
}
