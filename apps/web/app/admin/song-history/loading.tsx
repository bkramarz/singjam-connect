export default function SongHistoryLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-12 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
