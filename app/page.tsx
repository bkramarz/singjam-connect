export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Keep the music going between jams.</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Find people to sing and play acoustic music with—based on the songs you already know.
        </p>
        <div className="mt-4 flex gap-2">
          <a className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50" href="/auth">
            Sign in / Create account
          </a>
          <a className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50" href="/songs">
            Browse songs
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="font-semibold">Repertoire packs</div>
          <div className="mt-1 text-sm text-zinc-600">
            Start with SingJam Core 50 and other community packs—instant overlap.
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="font-semibold">Real matching</div>
          <div className="mt-1 text-sm text-zinc-600">
            See how many songs you share, plus complementary roles and distance.
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="font-semibold">Low-pressure jams</div>
          <div className="mt-1 text-sm text-zinc-600">
            Post a casual circle or invite a few people. Addresses stay private until accepted.
          </div>
        </div>
      </div>
    </div>
  );
}