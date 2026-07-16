export default function SongEditorLoading() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 animate-pulse rounded bg-zinc-200" />

      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
        <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
        <div className="mt-2 h-9 animate-pulse rounded-lg bg-zinc-100" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-4 w-8 shrink-0 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <div className="h-5 w-24 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
