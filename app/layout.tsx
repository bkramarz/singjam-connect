import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: "SingJam Connect",
  description: "Find people to jam with based on shared repertoire.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="no-underline">
              <div className="font-semibold">SingJam Connect</div>
              <div className="text-xs text-zinc-500">Acoustic-first • Bay Area</div>
            </Link>

            <TopNav />
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

        <footer className="mx-auto max-w-3xl px-4 py-10 text-xs text-zinc-500">
          © {new Date().getFullYear()} SingJam • Community-first matching by repertoire
        </footer>
      </body>
    </html>
  );
}