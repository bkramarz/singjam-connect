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

  const { count: reviewCount } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .eq("needs_review", true);

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
          <Link href="/admin/songs/import" className="text-slate-600 hover:text-slate-900">
            Import CSV
          </Link>
          <Link href="/admin/songs/review" className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900">
            Review
            {!!reviewCount && reviewCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                {reviewCount}
              </span>
            )}
          </Link>
          <Link href="/admin/settings" className="text-slate-600 hover:text-slate-900">
            Settings
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
