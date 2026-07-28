const SHELL_STYLE = "font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px";
const BUTTON_STYLE =
  "display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none";
const FOOTER = `<p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>`;

function shell({ heading, body, cta }: { heading: string; body: string; cta: { href: string; label: string } }) {
  return `<!DOCTYPE html>
<html>
<body style="${SHELL_STYLE}">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">${heading}</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    ${body}
  </p>
  <a href="${cta.href}" style="${BUTTON_STYLE}">${cta.label}</a>
  ${FOOTER}
</body>
</html>`;
}

// Sent once the user saves their profile, so `name` is the first name they
// chose rather than a system-generated handle.
export function welcomeEmailHtml({ name }: { name?: string } = {}) {
  const greeting = name ? `Hi ${name},<br />` : "";
  return shell({
    heading: "Welcome to SingJam",
    body: `${greeting}You're in. Start by adding songs to your repertoire so we can find you musicians to jam with.`,
    cta: { href: "https://singjam.org/search", label: "Add songs to your repertoire" },
  });
}

// Fallback for signups that never finished setup — they have no name to greet,
// so nudge them back to the profile form instead of welcoming them in.
export function finishSetupEmailHtml() {
  return shell({
    heading: "Finish setting up your SingJam profile",
    body:
      "You created a SingJam account but haven't set up your profile yet. It takes a minute — pick a username, tell us what you play, and we'll start matching you with musicians who share your repertoire.",
    cta: { href: "https://singjam.org/account", label: "Finish your profile" },
  });
}
