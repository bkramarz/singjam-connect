import AuthPanel from "@/components/AuthPanel";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ invite?: string; next?: string; error?: string }> }) {
  const { invite, next, error } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      {invite ? (
        <>
          <h1 className="text-xl font-semibold">You've been invited to a jam</h1>
          <p className="mt-2 text-sm text-zinc-600">Sign in or create a free account to view the invite and RSVP.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600">Sign in or create an account to get started.</p>
        </>
      )}
      {error && (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {decodeURIComponent(error)}
        </div>
      )}
      <div className="mt-4">
        <AuthPanel inviteToken={invite} defaultMode={invite ? "signup" : "signin"} next={next} />
      </div>
    </div>
  );
}
