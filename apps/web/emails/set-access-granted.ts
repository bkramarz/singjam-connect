export function setAccessGrantedHtml({
  setName,
  setUrl,
}: {
  setName: string;
  setUrl: string;
}) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">You've been granted access</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    Your request to access <strong>${setName}</strong> has been approved. You can now view the set list.
  </p>
  <a href="${setUrl}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    View set list
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;
}
