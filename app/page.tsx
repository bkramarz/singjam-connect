import HomeButtons from "@/components/HomeButtons";
import UpcomingJams from "@/components/UpcomingJams";

export default function HomePage() {
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
          <div className="mt-8 flex flex-wrap gap-3">
            <HomeButtons />
          </div>
        </div>
      </div>

      <UpcomingJams />
    </div>
  );
}
