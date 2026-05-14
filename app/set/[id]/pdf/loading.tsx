export default function Loading() {
  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden">
      <aside className="w-72 shrink-0 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-5 border-b border-zinc-100">
          <div className="h-3 w-16 bg-zinc-200 rounded animate-pulse mb-2" />
          <div className="h-5 w-40 bg-zinc-200 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-5 space-y-6">
          <div className="space-y-2">
            <div className="h-3 w-14 bg-zinc-200 rounded animate-pulse" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="h-4 w-4 bg-zinc-200 rounded animate-pulse" />
                <div className="h-3 w-28 bg-zinc-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-3 w-12 bg-zinc-200 rounded animate-pulse" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="h-4 w-4 bg-zinc-200 rounded-full animate-pulse mt-0.5" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 bg-zinc-200 rounded animate-pulse" />
                  <div className="h-2.5 w-48 bg-zinc-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 border-t border-zinc-100">
          <div className="h-10 w-full bg-zinc-200 rounded-xl animate-pulse" />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-sm px-14 py-12 space-y-3">
          <div className="h-7 w-48 bg-zinc-200 rounded animate-pulse mb-4" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-3 py-2 border-b border-zinc-100">
              <div className="h-3 w-4 bg-zinc-200 rounded animate-pulse" />
              <div className="h-3 flex-1 bg-zinc-200 rounded animate-pulse" />
              <div className="h-3 w-28 bg-zinc-100 rounded animate-pulse" />
              <div className="h-3 w-6 bg-zinc-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
