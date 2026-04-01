export function memberInviteHtml({
  inviterName,
  inviteeName,
  jamName,
  startsAt,
  jamUrl,
}: {
  inviterName: string;
  inviteeName?: string | null;
  jamName: string;
  startsAt?: string | null;
  jamUrl: string;
}) {
  const greeting = inviteeName ? `Hi ${inviteeName},` : "Hey,";
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">You're invited!</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} <strong>${inviterName}</strong> has invited you to <strong>${jamName}</strong>${startsAt ? ` on ${startsAt}` : ""}.
  </p>
  <a href="${jamUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View invite
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}

export function nonMemberInviteHtml({
  inviterName,
  jamName,
  startsAt,
  signupUrl,
}: {
  inviterName: string;
  jamName: string;
  startsAt?: string | null;
  signupUrl: string;
}) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">You're invited to join SingJam</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    <strong>${inviterName}</strong> has invited you to <strong>${jamName}</strong>${startsAt ? ` on ${startsAt}` : ""}.
    Create a free SingJam account to view the event and RSVP.
  </p>
  <a href="${signupUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    Join SingJam &amp; view invite
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}
