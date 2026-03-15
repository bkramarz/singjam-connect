import { redirect } from "next/navigation";
import { getSessionServer } from "@/lib/supabase/server";
import NewJamForm from "@/components/NewJamForm";

export default async function NewJamPage() {
  const session = await getSessionServer();
  if (!session) redirect("/auth");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Post a jam</h1>
      <p className="text-sm text-zinc-600">Casual. Acoustic. Address hidden until accepted.</p>
      <NewJamForm />
    </div>
  );
}
