import type { Metadata } from 'next';
import { SectionWrapper } from '@/components/ui/section-wrapper';

export const metadata: Metadata = {
  title: 'Terms of Service — DocuForge',
  description: 'DocuForge terms of service.',
};

const LAST_UPDATED = '2026-05-20';

export default function TermsPage() {
  return (
    <SectionWrapper>
      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-text-dim">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="space-y-8 text-text-muted leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">1. The service</h2>
            <p>
              DocuForge (&ldquo;we&rdquo;, &ldquo;our&rdquo;) provides an HTTP API for generating
              PDFs from HTML, templates, or React components, plus SDKs and a hosted dashboard at{' '}
              <a href="https://app.getdocuforge.dev" className="text-accent hover:underline">
                app.getdocuforge.dev
              </a>
              . By creating an account or sending requests to{' '}
              <code className="text-accent">api.getdocuforge.dev</code> you accept these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">2. Acceptable use</h2>
            <p>
              You may not use the service to generate content that is illegal in your jurisdiction
              or ours (US/EU), to send spam, to host phishing or malware, to violate intellectual
              property rights, or to attempt to compromise the service or other customers&apos;
              data. We reserve the right to suspend accounts that violate these rules with notice
              where practical.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">3. Your content</h2>
            <p>
              You retain all rights to the content you submit and the PDFs we generate from it. We
              process your content only to render PDFs and to provide the service you requested.
              See our{' '}
              <a href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </a>{' '}
              for details on storage and deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">4. Billing</h2>
            <p>
              Free plan is permanent and includes 1,000 PDFs per month. Paid plans are billed
              monthly in advance and renew automatically until canceled. Usage above plan limits
              is rejected at the API; we do not silently invoice for overages. Refunds are issued
              for unused full months on cancellation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">5. Availability</h2>
            <p>
              The service is offered &ldquo;as is&rdquo; without warranty. We work to keep
              uptime high but make no SLA commitment on Free or Starter. Pro includes a 99.5%
              monthly uptime target and Enterprise plans include a contractual SLA.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">6. Liability</h2>
            <p>
              To the maximum extent permitted by law, our aggregate liability under these terms
              for any month will not exceed the fees you paid us in that month. We are not liable
              for indirect or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">7. Changes</h2>
            <p>
              We may update these terms. Material changes are announced via email and on this page
              at least 30 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-text-primary mb-3">8. Contact</h2>
            <p>
              Questions about these terms?{' '}
              <a href="/contact" className="text-accent hover:underline">
                Reach us via the contact page
              </a>
              .
            </p>
          </section>

          <p className="text-xs text-text-dim border-t border-border-subtle pt-6 mt-10">
            This page is a plain-English summary of the operative terms. A signable PDF version is
            available on request for enterprise procurement.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
