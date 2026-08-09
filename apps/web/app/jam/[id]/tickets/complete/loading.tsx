export default function Loading() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8" aria-busy="true">
      <div className="h-7 w-64 animate-pulse rounded bg-zinc-200" />
      <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
      <div className="h-11 w-40 animate-pulse rounded-xl bg-zinc-200" />
    </div>
  );
}
