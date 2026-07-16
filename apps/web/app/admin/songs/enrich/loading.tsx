export default function BulkEnrichLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-72 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-lg bg-zinc-100" />
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-24 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-6 w-32 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
