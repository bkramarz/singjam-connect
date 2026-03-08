import { redirect } from "next/navigation";
import AccountPanel from "@/components/AccountPanel";
import { getSessionServer } from "@/lib/supabase/server";

export default async function AccountPage() {
  const session = await getSessionServer();
  if (!session) redirect("/auth");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Account</h1>
      <AccountPanel />
    </div>
  );
}
