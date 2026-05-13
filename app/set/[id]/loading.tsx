export default function SetLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
      </div>

      {/* Link sharing row */}
      <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />

      {/* Collaborators */}
      <ul className="space-y-2">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-zinc-200" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-200" />
          </li>
        ))}
      </ul>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-zinc-100" />
        <div className="h-9 w-32 animate-pulse rounded-xl bg-zinc-100" />
      </div>

      {/* Song list */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <div className="mt-0.5 h-4 w-4 animate-pulse rounded bg-zinc-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
