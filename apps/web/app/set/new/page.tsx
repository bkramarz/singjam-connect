import { redirect } from "next/navigation";
import { getSessionServer } from "@/lib/supabase/server";
import NewSetForm from "@/components/NewSetForm";

export default async function NewSetPage() {
  const session = await getSessionServer();
  if (!session) redirect("/auth");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New set</h1>
      <p className="text-sm text-zinc-600">Create a set list to collaborate on with other musicians.</p>
      <NewSetForm />
    </div>
  );
}
