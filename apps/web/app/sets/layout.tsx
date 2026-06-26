import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Sets",
  description: "Create and share set lists for your jams. Collaborate with other musicians and build the perfect song lineup.",
};
export default function SetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
