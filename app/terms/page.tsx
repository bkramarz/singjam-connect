import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6 text-sm text-zinc-700">
      <h1 className="text-2xl font-semibold text-zinc-900">Terms of Service</h1>
      <p className="text-zinc-500">Last updated: March 26, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">1. Acceptance</h2>
        <p>By using SingJam ("the Service"), you agree to these Terms. If you do not agree, please do not use the Service.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">2. What SingJam is</h2>
        <p>SingJam is a platform for musicians to discover jam partners based on shared repertoire and to organise informal music sessions. We do not facilitate commercial transactions or ticketed events.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">3. Your account</h2>
        <p>You are responsible for maintaining the security of your account and for all activity that occurs under it. You must be at least 13 years old to use SingJam. Accounts found to be used for spam or abuse will be removed.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">4. Acceptable use</h2>
        <p>You agree not to use SingJam to harass other users, post false or misleading information, or attempt to gain unauthorised access to any part of the Service. Jam listings must represent genuine, good-faith musical gatherings.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">5. Content</h2>
        <p>You retain ownership of any content you post (profile information, jam listings). By posting, you grant SingJam a limited licence to display that content to other users of the Service. We reserve the right to remove content that violates these Terms.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">6. Availability</h2>
        <p>We aim to keep SingJam running reliably but cannot guarantee uninterrupted access. The Service is provided as-is, without warranty of any kind.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">7. Termination</h2>
        <p>You may delete your account at any time from your profile settings. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">8. Changes</h2>
        <p>We may update these Terms occasionally. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">9. Contact</h2>
        <p>Questions? Email us at <a href="mailto:hello@singjam.org" className="text-amber-600 underline">hello@singjam.org</a>.</p>
      </section>
    </div>
  );
}
