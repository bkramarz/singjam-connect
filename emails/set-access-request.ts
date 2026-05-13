export function setAccessRequestHtml({
  requesterName,
  setName,
  setUrl,
}: {
  requesterName: string;
  setName: string;
  setUrl: string;
}) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Someone wants access to your set list</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    <strong>${requesterName}</strong> has requested access to your set list <strong>${setName}</strong>.
    Open the set to invite them as a collaborator.
  </p>
  <a href="${setUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View set list
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}
