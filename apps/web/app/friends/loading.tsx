export default function FriendsLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Find jammers</h1>
      <p className="text-sm text-zinc-600">Matches are ranked by shared songs and genre overlap.</p>
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="space-y-1 text-right">
                <div className="ml-auto h-4 w-6 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
