type AuthUserPage = {
  data: { users: { id: string; email?: string | null }[] };
  error: { message: string } | null;
};

type AuthAdmin = {
  listUsers: (params: { page: number; perPage: number }) => Promise<AuthUserPage>;
};

/**
 * Email addresses live on auth.users, not profiles, and listUsers returns one
 * page at a time — a single call silently stops at perPage. Walk every page and
 * key the addresses by user id.
 */
export async function fetchAllAuthEmails(
  admin: AuthAdmin,
  perPage = 1000
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const batch = data?.users ?? [];
    for (const user of batch) {
      if (user.email) emails.set(user.id, user.email);
    }
    if (batch.length < perPage) return emails;
  }
}
