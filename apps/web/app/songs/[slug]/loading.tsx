export default function SongPageLoading() {
  return (
    <div className="min-h-screen space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-2/3 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-baseline gap-4">
            <div className="h-3 w-20 shrink-0 animate-pulse rounded bg-zinc-200" />
            <div className="flex flex-wrap gap-1.5">
              <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-10 w-32 animate-pulse rounded-xl bg-zinc-100" />
    </div>
  );
}
