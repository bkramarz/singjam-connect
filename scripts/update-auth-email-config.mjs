// Updates Supabase Auth email settings via the Management API:
//  - recovery email links to /auth/confirm with a token hash (works across
//    browsers/devices, unlike the default PKCE confirmation URL)
//  - branded template + subject matching our transactional emails
//  - with RESEND_API_KEY also set: auth emails sent via Resend SMTP from
//    hello@singjam.org (same sender as app emails)
//
// The Management API treats the smtp_* fields as one bundle — PATCHing any
// of them without the full set (host, port, user, pass, admin email) wipes
// the custom SMTP config and silently breaks all auth email sending. So the
// SMTP block is only included when RESEND_API_KEY is provided, and always in
// full.
//
// Run AFTER the /auth/confirm route is deployed, or new reset links will 404:
//   SUPABASE_ACCESS_TOKEN=sbp_... RESEND_API_KEY=re_... node scripts/update-auth-email-config.mjs

const PROJECT_REF = "orwkaalmfxzwifnmzvts";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (Management API token, sbp_...)");
  process.exit(1);
}

const resetLink = "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery";

const recoveryTemplate = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#18181b;padding:32px 16px">
  <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Reset your SingJam password</h1>
  <p style="font-size:15px;line-height:1.6;color:#52525b">
    Someone (hopefully you) requested a password reset for {{ .Email }}.
    Click the button below to choose a new password. This link expires in 1 hour.
  </p>
  <a href="${resetLink}"
     style="display:inline-block;margin-top:24px;background-color:#f59e0b;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">
    Reset password
  </a>
  <p style="margin-top:24px;font-size:13px;line-height:1.6;color:#a1a1aa">
    If the button doesn't work, copy and paste this link into your browser:<br>
    ${resetLink}
  </p>
  <p style="font-size:13px;color:#a1a1aa">If you didn't request this, you can safely ignore this email.</p>
  <p style="margin-top:32px;font-size:13px;color:#a1a1aa">SingJam · Music. Community. Love.</p>
</body>
</html>`;

const config = {
  mailer_subjects_recovery: "Reset your SingJam password",
  mailer_templates_recovery_content: recoveryTemplate,
};

if (process.env.RESEND_API_KEY) {
  Object.assign(config, {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: process.env.RESEND_API_KEY,
    smtp_admin_email: "hello@singjam.org",
    smtp_sender_name: "SingJam",
    smtp_max_frequency: 60,
  });
} else {
  console.log("RESEND_API_KEY not set — leaving SMTP config untouched.");
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  }
);

if (!res.ok) {
  console.error(`Failed (${res.status}):`, await res.text());
  process.exit(1);
}

console.log("Auth email config updated.");
