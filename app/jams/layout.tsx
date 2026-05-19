import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Jams",
  description: "Browse and RSVP to upcoming jams in your area. Find singers and musicians who share your repertoire.",
};
export default function JamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
