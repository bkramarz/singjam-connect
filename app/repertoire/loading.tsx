export default function RepertoireLoading() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Repertoire</h1>
        <div className="mt-1 h-3 w-16 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
        <div className="h-9 animate-pulse rounded-xl bg-zinc-100" />
      </div>
      <div className="divide-y rounded-md border">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="space-y-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
