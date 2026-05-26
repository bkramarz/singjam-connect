export function setCollaboratorInviteHtml({
  inviterName,
  inviteeName,
  setName,
  role,
  setUrl,
}: {
  inviterName: string;
  inviteeName?: string | null;
  setName: string;
  role: "editor" | "viewer";
  setUrl: string;
}) {
  const greeting = inviteeName ? `Hi ${inviteeName},` : "Hi,";
  const roleLabel = role === "editor" ? "editor" : "viewer";
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">You've been added to a set list</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} <strong>${inviterName}</strong> added you as a <strong>${roleLabel}</strong> on the set list <strong>${setName}</strong>.
  </p>
  <a href="${setUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View set list
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;
}

export function setCollaboratorNonMemberInviteHtml({
  inviterName,
  setName,
  signupUrl,
}: {
  inviterName: string;
  setName: string;
  signupUrl: string;
}) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">You're invited to collaborate on a set list</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    <strong>${inviterName}</strong> invited you to collaborate on <strong>${setName}</strong> on SingJam.
    Create a free account to view and contribute to the set list.
  </p>
  <a href="${signupUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View invite
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;
}
