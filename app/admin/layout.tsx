import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");

  return (
    <div>
      <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-4">
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          Admin
        </span>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin/songs" className="text-slate-600 hover:text-slate-900">
            Songs
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
