import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import MobileHeaderProfile from "@/components/MobileHeaderProfile";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SingJam",
    template: "SingJam - %s",
  },
  description: "Find people to sing and jam with based on shared repertoire.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-10 bg-slate-900">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">SingJam</span>
            </Link>

            <div className="hidden sm:flex">
              <TopNav />
            </div>
            <MobileHeaderProfile />
          </div>
        </header>

        <div className="overflow-x-hidden">
        <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">{children}</main>

        <footer className="mx-auto hidden max-w-4xl px-6 py-10 sm:block">
          <div className="border-t border-slate-200 pt-8 text-xs text-slate-400 flex items-center justify-between gap-4">
            <span>© {new Date().getFullYear()} SingJam · Community-first matching by repertoire</span>
            <div className="flex gap-4">
              <Link href="/feedback" className="hover:text-slate-600">Report a bug</Link>
              <Link href="/privacy" className="hover:text-slate-600">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-slate-600">Terms of Service</Link>
            </div>
          </div>
        </footer>
        </div>

        <BottomNav />
      </body>
    </html>
  );
}
