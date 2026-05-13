export default function AccountLoading() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      <div className="space-y-5">
        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-zinc-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
              <div className="h-9 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
