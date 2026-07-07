import type { Metadata } from 'next';
import { Mail, MessageCircle, Github } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Contact — Deckle',
  description: 'Get in touch about Deckle — sales, support, security, or just to say hello.',
  alternates: {
    canonical: '/contact',
  },
};

const CHANNELS = [
  {
    icon: Mail,
    title: 'Sales',
    body: 'For enterprise volume, custom contracts, SLAs, or self-hosting.',
    cta: { label: 'sales@getdeckle.dev', href: 'mailto:sales@getdeckle.dev' },
  },
  {
    icon: MessageCircle,
    title: 'Support',
    body: 'Stuck on an integration or hitting unexpected errors? Reply to any drip email or use this address.',
    cta: { label: 'support@getdeckle.dev', href: 'mailto:support@getdeckle.dev' },
  },
  {
    icon: Mail,
    title: 'Security',
    body: 'Vulnerability reports and security questions. See the Security page for details on safe-harbor.',
    cta: { label: 'security@getdeckle.dev', href: 'mailto:security@getdeckle.dev' },
  },
  {
    icon: Github,
    title: 'GitHub',
    body: 'Public issues, SDK bugs, and feature requests.',
    cta: { label: 'github.com/Yoshyaes/deckle', href: 'https://github.com/Yoshyaes/deckle' },
  },
];

export default function ContactPage() {
  return (
    <SectionWrapper>
      <header className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-text-primary tracking-tight mb-4">
          Contact
        </h1>
        <p className="text-text-muted">
          Pick the channel that matches your question — that&apos;s the fastest way to get a real
          answer.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {CHANNELS.map((c) => (
          <Card key={c.title} className="p-6 flex flex-col">
            <c.icon className="text-accent mb-3" size={20} />
            <h2 className="text-base font-semibold text-text-primary mb-1.5">{c.title}</h2>
            <p className="text-sm text-text-muted leading-relaxed mb-4 flex-1">{c.body}</p>
            <a
              href={c.cta.href}
              className="text-sm font-medium text-accent hover:underline self-start"
              rel="noopener noreferrer"
            >
              {c.cta.label}
            </a>
          </Card>
        ))}
      </div>
    </SectionWrapper>
  );
}
