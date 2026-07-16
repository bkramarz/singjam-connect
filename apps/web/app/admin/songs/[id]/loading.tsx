export default function SongEditorLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
            <div className="h-9 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            <div className="h-9 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        ))}
      </div>

      <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-200" />
    </div>
  );
}
