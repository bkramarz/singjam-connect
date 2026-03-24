import type { Metadata } from "next";
export const metadata: Metadata = { title: "Repertoire" };
export default function RepertoireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
