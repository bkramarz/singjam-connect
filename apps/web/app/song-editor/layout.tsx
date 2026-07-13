import { redirect } from "next/navigation";
import { getServerUser, getServerUserRole } from "@/lib/supabase/cached";

export default async function SongEditorLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  if (!user) redirect("/auth?next=/song-editor");

  const role = await getServerUserRole();
  if (role !== "song_editor" && role !== "admin") redirect("/");

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
