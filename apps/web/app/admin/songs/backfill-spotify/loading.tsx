export default function BackfillSpotifyLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-56 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-80 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-100" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
