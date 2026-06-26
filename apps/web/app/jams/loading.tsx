export default function JamsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Jams</h1>
        <p className="text-sm text-zinc-500">Browse open jams or post your own.</p>
      </div>
      <section className="space-y-3">
        <div className="h-3 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="grid grid-cols-1 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="shrink-0 w-20 animate-pulse bg-zinc-100 border-r border-zinc-100 py-10" />
              <div className="flex-1 p-4 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
