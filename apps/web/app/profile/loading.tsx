export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-zinc-200" />
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
