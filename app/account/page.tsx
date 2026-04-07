import { redirect } from "next/navigation";
import AccountPanel from "@/components/AccountPanel";
import { getSessionServer } from "@/lib/supabase/server";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [session, { next }] = await Promise.all([getSessionServer(), searchParams]);
  if (!session) redirect("/auth");
  const safeNext = next && /^\/[^/]/.test(next) ? next : undefined;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      <AccountPanel next={safeNext} />
    </div>
  );
}
