import type { Metadata } from "next";
export const metadata: Metadata = { title: "Jams" };
export default function JamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
