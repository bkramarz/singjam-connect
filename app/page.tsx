import Link from "next/link";
import { getSessionServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const session = await getSessionServer();
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-10 sm:px-12 sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Bay Area music community
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Build your repertoire.<br />
            <span className="text-amber-400">Sing and jam with friends.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base text-slate-400">
            Find people to sing and play music with based on the songs you already know.
            Discover new songs and new friends.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {session ? (
              <>
                <Link
                  href="/search"
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-400 transition-colors"
                >
                  Add songs
                </Link>
                <Link
                  href="/jams"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 transition-colors"
                >
                  Join a jam
                </Link>
              </>
            ) : (
              <Link
                href="/auth"
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-400 transition-colors"
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="mt-4 text-base font-semibold text-slate-900">Real matching</div>
          <div className="mt-1.5 text-sm text-slate-500">
            See how many songs you share with each person, plus complementary roles and location.
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.25M6.633 10.5H5.25a1.5 1.5 0 00-1.5 1.5v4.5a1.5 1.5 0 001.5 1.5h1.383" />
            </svg>
          </div>
          <div className="mt-4 text-base font-semibold text-slate-900">Low-pressure jams</div>
          <div className="mt-1.5 text-sm text-slate-500">
            Post a casual circle or invite a few people. Addresses stay private until accepted.
          </div>
        </div>
      </div>
    </div>
  );
}
