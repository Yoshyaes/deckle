import type { Metadata } from 'next';
import { SectionWrapper } from '@/components/ui/section-wrapper';

export const metadata: Metadata = {
  title: 'Privacy Policy — Deckle',
  description: 'How Deckle handles your data.',
  alternates: {
    canonical: '/privacy',
  },
};

const LAST_UPDATED = '2026-05-20';

export default function PrivacyPage() {
  return (
    <SectionWrapper>
      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-text-dim">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="space-y-8 text-text-muted leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-text-primary">Account data</strong> — email, password
                hash, organization name. Required to sign in.
              </li>
              <li>
                <strong className="text-text-primary">API content</strong> — the HTML, templates,
                or data you submit. Required to render PDFs.
              </li>
              <li>
                <strong className="text-text-primary">Generation metadata</strong> — timestamps,
                page count, file size, status. Used for billing and dashboards.
              </li>
              <li>
                <strong className="text-text-primary">Billing data</strong> — Stripe customer ID,
                subscription status. Card details live in Stripe, not here.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">What we don&apos;t do</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do not sell your data.</li>
              <li>We do not train AI on your content.</li>
              <li>We do not embed third-party trackers on the dashboard.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Storage and retention</h2>
            <p>
              Generated PDFs are stored in your chosen storage provider (Cloudflare R2, AWS S3,
              Google Cloud Storage, or local filesystem on self-hosted). On the hosted plan, PDFs
              are retained for 30 days then deleted. Generation metadata is retained until the
              account is deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Subprocessors</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-text-primary">Clerk</strong> — authentication
              </li>
              <li>
                <strong className="text-text-primary">Stripe</strong> — billing
              </li>
              <li>
                <strong className="text-text-primary">Resend</strong> — transactional email
              </li>
              <li>
                <strong className="text-text-primary">Fly.io</strong> — application hosting (US +
                EU regions available)
              </li>
              <li>
                <strong className="text-text-primary">Anthropic</strong> — only when you call the{' '}
                <code className="text-accent">/v1/ai/generate-template</code> endpoint
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Your rights</h2>
            <p>
              EU/UK residents have rights under GDPR (access, rectification, erasure, portability,
              objection). Account deletion via the dashboard removes your account and all
              generated PDFs; subprocessor records (Stripe, Clerk) are deleted on request. Contact
              us via the{' '}
              <a href="/contact" className="text-accent hover:underline">
                contact page
              </a>{' '}
              to file a data request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Changes</h2>
            <p>
              Material changes are announced via email and on this page at least 30 days before
              they take effect.
            </p>
          </section>

          <p className="text-xs text-text-dim border-t border-border-subtle pt-6 mt-10">
            A signable DPA (Data Processing Agreement) is available on request for customers who
            require one.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
