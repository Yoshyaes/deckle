import type { Metadata } from 'next';
import { Lock, Key, Server, Eye, Mail } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Security — DocuForge',
  description:
    'How DocuForge protects your data: bcrypt-hashed API keys, signed webhooks, isolated rendering, and a published vulnerability-disclosure policy.',
};

const PILLARS = [
  {
    icon: Key,
    title: 'API key handling',
    body: 'Keys are bcrypt-hashed at rest with a per-key salt. The full key value is shown exactly once at creation and never stored in plaintext. Revocation is immediate and invalidates the key for both the dashboard and the API.',
  },
  {
    icon: Server,
    title: 'Rendering isolation',
    body: 'Each PDF render uses a fresh Playwright browser context with JavaScript disabled. Outbound webhooks pass through SSRF guards (DNS check, scheme/port allowlist, redirect restriction). The React renderer is disabled by default until our V8-isolate sandbox lands.',
  },
  {
    icon: Lock,
    title: 'Transport and storage',
    body: 'All traffic to api.getdocuforge.dev is TLS 1.2+. Generated PDFs are written to your chosen S3-compatible storage (R2, S3, GCS). Storage credentials live in env vars, not in the code repo.',
  },
  {
    icon: Eye,
    title: 'Webhooks',
    body: 'Inbound webhooks (Stripe, Clerk) verify the provider signature before applying any state. Outbound webhooks include an HMAC signature header so you can verify authenticity on your side — see the docs for the verification snippet.',
  },
];

export default function SecurityPage() {
  return (
    <SectionWrapper>
      <header className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-text-primary tracking-tight mb-4">
          Security
        </h1>
        <p className="text-text-muted">
          DocuForge is a public-beta product. This page is an honest snapshot of what is in place
          today and what is on the roadmap, so you can make an informed call about whether the
          posture meets your bar before you ship.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto mb-12">
        {PILLARS.map((p) => (
          <Card key={p.title} className="p-6">
            <p.icon className="text-accent mb-3" size={22} />
            <h2 className="text-lg font-semibold text-text-primary mb-2">{p.title}</h2>
            <p className="text-sm text-text-muted leading-relaxed">{p.body}</p>
          </Card>
        ))}
      </div>

      <div className="max-w-3xl mx-auto space-y-8 text-text-muted leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-3">On the roadmap</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              SOC 2 Type II — engagement opens once we have 12 months of operational evidence.
            </li>
            <li>
              <code className="text-accent">@docuforge/react</code> rendering in{' '}
              <code className="text-accent">isolated-vm</code> rather than Node&apos;s built-in{' '}
              <code className="text-accent">vm</code>.
            </li>
            <li>
              Real AES encryption for <code className="text-accent">POST /v1/pdf/protect</code>{' '}
              via a native qpdf module. (The endpoint is currently disabled rather than ship a
              misrepresentation.)
            </li>
            <li>Cryptographic (PAdES) digital signatures for PDFs.</li>
            <li>HIPAA-eligible enterprise plan and a signable BAA.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            <Mail className="inline mr-2" size={18} />
            Reporting a vulnerability
          </h2>
          <p>
            Email <a href="mailto:security@getdocuforge.dev" className="text-accent hover:underline">security@getdocuforge.dev</a>{' '}
            with reproduction steps. We respond within two business days and treat
            good-faith research under safe-harbor terms. Please do not publicly disclose until we
            have shipped a fix or 90 days have passed, whichever is sooner.
          </p>
        </section>
      </div>
    </SectionWrapper>
  );
}
