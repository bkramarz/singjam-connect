export default function ReviewSongsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-52 animate-pulse rounded bg-zinc-200" />

      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-20 animate-pulse rounded-full bg-zinc-100" />
              </div>
              <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-7 w-14 animate-pulse rounded-lg bg-zinc-100" />
              <div className="h-7 w-16 animate-pulse rounded-lg bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
