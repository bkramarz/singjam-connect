import { Suspense } from "react";
import type { Metadata } from "next";
import HomeButtons from "@/components/HomeButtons";
import UpcomingJams, { UpcomingJamsSkeleton } from "@/components/UpcomingJams";

export const metadata: Metadata = {
  description: "Find your people through shared music. Build your repertoire, discover musicians nearby, and get invited to jams in your community.",
  openGraph: {
    title: "SingJam",
    description: "Find your people through shared music. Build your repertoire, discover musicians nearby, and get invited to jams in your community.",
  },
};

export default async function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-10 sm:px-12 sm:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent" />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Build your repertoire.<br />
            <span className="text-amber-400">Sing and jam with friends.</span>
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomeButtons />
          </div>
        </div>
      </div>

      <Suspense fallback={<UpcomingJamsSkeleton />}>
        <UpcomingJams />
      </Suspense>
    </div>
  );
}
