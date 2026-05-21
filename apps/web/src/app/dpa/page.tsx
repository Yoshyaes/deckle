import type { Metadata } from 'next';
import { SectionWrapper } from '@/components/ui/section-wrapper';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — DocuForge',
  description:
    'How to obtain a Data Processing Agreement (DPA) for DocuForge — required for EU customer onboarding under GDPR.',
};

const LAST_UPDATED = '2026-05-20';

export default function DpaPage() {
  return (
    <SectionWrapper>
      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight mb-2">
            Data Processing Agreement
          </h1>
          <p className="text-sm text-text-dim">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="space-y-6 text-text-muted leading-relaxed">
          <p>
            DocuForge offers a signable Data Processing Agreement (DPA) to customers who require
            one for GDPR Article 28 or comparable regulatory obligations. The DPA references the
            EU Standard Contractual Clauses (2021/914) for transfers of personal data outside the
            EEA.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">How to request</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Email{' '}
                <a href="mailto:legal@getdocuforge.dev" className="text-accent hover:underline">
                  legal@getdocuforge.dev
                </a>{' '}
                from your work address with your company name and the DocuForge account email.
              </li>
              <li>
                We send the DPA as a DocuSign or PandaDoc envelope. Most customers receive it
                within one business day.
              </li>
              <li>
                Sign and return. The signed DPA is binding on both parties and supersedes the
                privacy summary in our{' '}
                <a href="/privacy" className="text-accent hover:underline">
                  privacy policy
                </a>
                .
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">What the DPA covers</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Categories of data subjects (your end users) and personal data we process.</li>
              <li>Purpose and duration of processing.</li>
              <li>
                Technical and organisational measures we apply (subprocessor controls, encryption
                in transit and at rest, access controls).
              </li>
              <li>Subprocessor list — currently Clerk, Stripe, Resend, Fly.io, Anthropic.</li>
              <li>Audit rights and breach-notification timelines (72 hours).</li>
              <li>Standard Contractual Clauses for international transfers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">Self-hosting</h2>
            <p>
              If you run DocuForge from{' '}
              <a href="https://docs.getdocuforge.dev" className="text-accent hover:underline">
                our open-source repo
              </a>{' '}
              on your own infrastructure, you are the data controller AND processor for your end
              users — DocuForge has no access to the data. In that case a DPA between you and
              DocuForge is not required for the data you process. You may still want one with
              your own hosting provider.
            </p>
          </section>

          <p className="text-xs text-text-dim border-t border-border-subtle pt-6 mt-10">
            Questions about scope, subprocessors, or contractual edits? Reply to the email we
            send with the envelope. We engage on every reasonable request.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
