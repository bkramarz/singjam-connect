import type { Metadata } from "next";
import AuthPanel from "@/components/AuthPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Join SingJam to connect with singers and musicians through shared repertoire. Find jam partners in your community.",
};

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ invite?: string; next?: string; error?: string; mode?: string }> }) {
  const { invite, next, error, mode } = await searchParams;

  const isSignup = mode === "signup" || !!invite;

  return (
    <div className="mx-auto max-w-md">
      {invite ? (
        <>
          <h1 className="text-xl font-semibold">You've been invited to a jam</h1>
          <p className="mt-2 text-sm text-zinc-600">Sign in or create a free account to view the invite and RSVP.</p>
        </>
      ) : isSignup ? (
        <>
          <h1 className="text-xl font-semibold">Join SingJam</h1>
          <p className="mt-2 text-sm text-zinc-600"><strong>Discover new music</strong> and <strong>new friends</strong>. Totally <strong>free</strong> — we&apos;ll only email you about <strong>cool music stuff</strong> 😎 🎸🥁</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-zinc-600">Sign in to <strong>discover new music</strong> and <strong>new friends</strong>. Our app is totally <strong>free to use</strong> and we will only email you about <strong>cool music stuff</strong> 😎 🎸🥁</p>
        </>
      )}
      {error && (
        <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
          {decodeURIComponent(error)}
        </div>
      )}
      <div className="mt-4">
        <AuthPanel inviteToken={invite} defaultMode={isSignup ? "signup" : "signin"} next={next} />
      </div>
    </div>
  );
}
