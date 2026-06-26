export default function SetsLoading() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Sets</h1>
        <p className="text-sm text-zinc-500">Curate ordered song lists for your performances.</p>
      </div>
      <section className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
        <div className="grid grid-cols-1 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
