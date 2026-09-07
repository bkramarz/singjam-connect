import type { Metadata } from "next";
import { fetchAllRows } from "@singjam/core";
import { getServerSupabase, getServerUser } from "@/lib/supabase/cached";
import AdminUsersTable, { type AdminUser } from "./AdminUsersTable";

export const metadata: Metadata = {
  title: "Users",
};

export default async function AdminUsersPage() {
  const supabase = await getServerSupabase();
  const [user, users] = await Promise.all([
    getServerUser(),
    fetchAllRows<AdminUser>((from, to) =>
      supabase
        .from("profiles")
        .select("id, display_name, last_name, username, avatar_url, neighborhood, created_at, role")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to) as any
    ),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">
            Everyone with a SingJam profile. Change a role to grant or remove access.
          </p>
        </div>
        <div className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{users.length}</span>{" "}
          {users.length === 1 ? "user" : "users"}
        </div>
      </div>

      <AdminUsersTable users={users} currentUserId={user?.id ?? ""} />
    </div>
  );
}
