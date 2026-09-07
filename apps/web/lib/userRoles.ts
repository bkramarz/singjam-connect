// The grantable values of the public.user_role enum (migration 102). The enum
// also carries 'unused_event_host', a retired label that grants nothing — it is
// deliberately absent here so it can't be assigned from the admin UI.
export const USER_ROLES = ["member", "song_editor", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  member: "Member",
  song_editor: "Song editor",
  admin: "Admin",
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: string): string {
  return isUserRole(role) ? ROLE_LABELS[role] : role;
}
