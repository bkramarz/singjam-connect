import type { Metadata } from "next";
import SongPageContent from "@/components/SongPageContent";

export const metadata: Metadata = { title: "Song — SingJam" };

export default function SongPage() {
  return <SongPageContent />;
}
