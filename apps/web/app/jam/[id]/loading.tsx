export default function JamLoading() {
  return (
    <div className="space-y-4 pb-10">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-100 animate-pulse" style={{ height: 320 }} />
      <div className="space-y-2 pt-2">
        <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-100" />
      </div>
      <div className="h-10 w-36 animate-pulse rounded-xl bg-zinc-100" />
    </div>
  );
}
