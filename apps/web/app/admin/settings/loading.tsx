export default function AdminSettingsLoading() {
  return (
    <div className="space-y-10 max-w-2xl">
      <div className="space-y-6">
        <div className="h-6 w-36 animate-pulse rounded bg-zinc-200" />
        <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          {[0].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-64 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-6 w-11 animate-pulse rounded-full bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>

      {[0, 1].map((i) => (
        <div key={i} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-72 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-8 w-28 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        </div>
      ))}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 animate-pulse rounded bg-zinc-200" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-zinc-100" />
        </div>
        <div className="h-4 w-72 animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  );
}
