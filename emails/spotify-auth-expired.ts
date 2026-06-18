export function spotifyAuthExpiredEmailHtml() {
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Spotify connection expired</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    A user attempted to sync a Spotify playlist but the refresh token has expired or been revoked.
  </p>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    Re-run the Spotify OAuth flow and update <code>SPOTIFY_REFRESH_TOKEN</code> in the Netlify environment variables to restore playlist syncing.
  </p>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;
}
