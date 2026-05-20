import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Pricing — DocuForge',
  description:
    'Simple, transparent pricing for the DocuForge PDF generation API. Free tier with 1,000 PDFs/month, paid plans from $29.',
};

const tiers = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Everything you need to evaluate, build a prototype, or run a side project.',
    cta: { label: 'Get Your API Key', href: 'https://app.getdocuforge.dev/sign-up?plan=free' },
    features: [
      '1,000 PDFs per month',
      'All input modes (HTML, templates, React*)',
      'All PDF tools (merge, split, forms, PDF/A)',
      'All SDKs (TS, Python, Go, Ruby) + MCP server',
      '10 requests / second',
      'Community support',
    ],
    note: '*React renderer is in private beta — see docs for opt-in.',
  },
  {
    name: 'Starter',
    price: '$29',
    cadence: 'per month',
    description: 'For shipping production workloads and small teams.',
    cta: { label: 'Start Starter', href: 'https://app.getdocuforge.dev/sign-up?plan=starter' },
    featured: true,
    features: [
      '10,000 PDFs per month',
      'Everything in Free',
      '100 requests / second',
      'Email support',
      'Webhook delivery',
      'Custom fonts',
    ],
  },
  {
    name: 'Pro',
    price: '$99',
    cadence: 'per month',
    description: 'For high-volume teams and customer-facing PDF features.',
    cta: { label: 'Start Pro', href: 'https://app.getdocuforge.dev/sign-up?plan=pro' },
    features: [
      '100,000 PDFs per month',
      'Everything in Starter',
      '100 requests / second',
      'Priority support (24h SLA)',
      'Batch & async generation',
      'Marketplace + template versioning',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Talk to us',
    cadence: '',
    description: 'For volume above 100k/month or contractual requirements.',
    cta: { label: 'Contact sales', href: '/contact' },
    features: [
      'Unlimited PDFs',
      'Everything in Pro',
      '500 requests / second',
      'Dedicated support + SLA',
      'Self-host option',
      'DPA, custom contract terms',
    ],
  },
];

export default function PricingPage() {
  return (
    <SectionWrapper>
      <header className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-text-primary tracking-tight mb-4">
          Pricing
        </h1>
        <p className="text-text-muted max-w-2xl mx-auto">
          Pay for the PDFs you generate, not for seats or features. No credit card to start.
        </p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`p-6 flex flex-col ${tier.featured ? 'ring-2 ring-accent/40' : ''}`}
          >
            {tier.featured && (
              <div className="text-[10px] uppercase tracking-widest text-accent font-bold mb-2">
                Most popular
              </div>
            )}
            <div className="text-sm font-medium text-text-primary mb-1">{tier.name}</div>
            <div className="flex items-baseline gap-1 mb-1">
              <div className="text-4xl font-bold text-text-primary">{tier.price}</div>
              {tier.cadence && <div className="text-xs text-text-dim">{tier.cadence}</div>}
            </div>
            <p className="text-xs text-text-muted mb-5">{tier.description}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-text-muted">
                  <Check size={14} className="text-green flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button className="w-full" size="md" href={tier.cta.href}>
              {tier.cta.label}
            </Button>
            {tier.note && (
              <p className="text-[11px] text-text-dim mt-3 leading-relaxed">{tier.note}</p>
            )}
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-text-dim mt-8">
        Plan limits are monthly. Overages are blocked at the limit — we never silently invoice you
        for usage you didn&apos;t consent to.
      </p>
    </SectionWrapper>
  );
}
