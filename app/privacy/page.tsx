import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6 text-sm text-zinc-700">
      <h1 className="text-2xl font-semibold text-zinc-900">Privacy Policy</h1>
      <p className="text-zinc-500">Last updated: March 26, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">1. What we collect</h2>
        <p>When you sign in with Google, we receive your name, email address, and profile photo. We also store the songs you add to your repertoire, your profile information (instrument, voice type, location), and any jams you post or join.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">2. How we use it</h2>
        <p>Your information is used solely to operate SingJam — to show your profile to other musicians, match you with jam partners based on shared repertoire, and let you manage your own account. We do not sell your data or use it for advertising.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">3. Who can see your information</h2>
        <p>Your name, profile photo, and repertoire are visible to other signed-in users of SingJam. Your email address is never shown publicly. Jam listings you post are visible to all visitors.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">4. Data storage</h2>
        <p>Your data is stored securely using Supabase (PostgreSQL), hosted on infrastructure provided by Supabase, Inc. We retain your data for as long as your account is active. You can delete your account at any time from your profile settings, which will permanently remove your personal data.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">5. Cookies</h2>
        <p>We use a session cookie to keep you signed in. No third-party tracking or advertising cookies are used.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">6. Third-party services</h2>
        <p>We use Google OAuth for authentication. Please refer to <a href="https://policies.google.com/privacy" className="text-amber-600 underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a> for details on how Google handles your data during sign-in.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">7. Contact</h2>
        <p>Questions about this policy? Email us at <a href="mailto:hello@singjam.org" className="text-amber-600 underline">hello@singjam.org</a>.</p>
      </section>
    </div>
  );
}
