import AuthPanel from "@/components/AuthPanel";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">Sign in or create an account to get started.</p>
      <div className="mt-4">
        <AuthPanel />
      </div>
    </div>
  );
}
