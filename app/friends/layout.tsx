import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Friends",
  description: "See who you match with based on shared songs. Connect with musicians in your community who already know the same tunes.",
};
export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
