export function WelcomeEmail({ username }: { username: string }) {
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto", color: "#18181b" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Welcome to SingJam</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#52525b" }}>
        Hi {username}, you're in. Start by adding songs to your repertoire so we can find you musicians to jam with.
      </p>
      <a
        href="https://singjam.org/search"
        style={{
          display: "inline-block",
          marginTop: 24,
          backgroundColor: "#f59e0b",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          padding: "10px 20px",
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        Add songs to your repertoire
      </a>
      <p style={{ marginTop: 32, fontSize: 13, color: "#a1a1aa" }}>
        SingJam · Find your jam partner
      </p>
    </div>
  );
}

export function welcomeEmailHtml({ username }: { username?: string } = {}) {
  const greeting = username ? `Hi ${username},` : "You're in.";
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Welcome to SingJam</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${greeting} Start by adding songs to your repertoire so we can find you musicians to jam with.
  </p>
  <a href="https://singjam.org/search"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    Add songs to your repertoire
  </a>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Find your jam partner</p>
</body>
</html>`;
}
