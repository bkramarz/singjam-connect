import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function SongEditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "song_editor" && profile?.role !== "admin") redirect("/");

  return (
    <div>
      <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-4">
        <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
          Song Editor
        </span>
      </div>
      {children}
    </div>
  );
}
