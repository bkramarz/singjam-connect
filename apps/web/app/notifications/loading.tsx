export default function NotificationsLoading() {
  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <div className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-zinc-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
