import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Repertoire",
  description: "Manage your song repertoire. Track which songs you can lead, support, or follow, and get matched with musicians who know the same songs.",
};
export default function RepertoireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
