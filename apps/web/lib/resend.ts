import { Resend } from "resend";
import { welcomeEmailHtml } from "@/emails/welcome";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_ADDRESS = "SingJam <hello@singjam.org>";

// Single source of truth for the welcome email. Called from every
// account-creation entry point (web email/password + OAuth callback, and
// native via /api/auth/complete) so the copy and send behaviour never drift.
export function sendWelcomeEmail(email: string, username?: string) {
  return resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Welcome to SingJam",
    html: welcomeEmailHtml({ username }),
  });
}
