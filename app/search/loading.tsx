export default function SearchLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Song Library</h1>
      <div className="h-10 animate-pulse rounded-xl bg-zinc-100" />
      <div className="divide-y rounded-md border">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <div className="space-y-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-7 w-16 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
