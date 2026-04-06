type Invite = {
  id: string;
  invited_user_id: string | null;
  invitee_email: string | null;
  status: string;
  display_name?: string | null;
  username?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Invited",
  accepted: "Going",
  declined: "Declined",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-500",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-50 text-red-500",
};

export default function JamInviteList({ invites }: { invites: Invite[] }) {
  if (invites.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
      <h2 className="text-base font-semibold">Invites</h2>
      <ul className="divide-y divide-zinc-100">
        {invites.map((inv) => {
          const label =
            inv.display_name ?? inv.username ?? inv.invitee_email ?? "Unknown";
          const sublabel =
            inv.invited_user_id && inv.invitee_email ? inv.invitee_email : null;
          const status = inv.status in STATUS_LABEL ? inv.status : "pending";

          return (
            <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-zinc-900 truncate">{label}</p>
                {sublabel && (
                  <p className="text-xs text-zinc-400 truncate">{sublabel}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
              >
                {STATUS_LABEL[status]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
