import { ScrollReveal } from '@/components/ui/scroll-reveal';

const metrics = [
  { value: '10,000+', label: 'PDFs generated' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<500ms', label: 'Avg response' },
  { value: '5', label: 'SDK languages' },
];

export function SocialProof() {
  return (
    <section className="border-y border-border-subtle">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ScrollReveal>
          <p className="text-center text-sm text-text-dim mb-8 uppercase tracking-wider">
            Trusted by developers building at
          </p>
        </ScrollReveal>

        {/* Placeholder logos */}
        <ScrollReveal delay={0.1}>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 mb-10 opacity-40">
            {['Vercel', 'Supabase', 'Stripe', 'Linear', 'Resend', 'Neon'].map(
              (name) => (
                <span
                  key={name}
                  className="text-lg font-bold text-text-primary tracking-tight"
                >
                  {name}
                </span>
              )
            )}
          </div>
        </ScrollReveal>

        {/* Metrics */}
        <ScrollReveal delay={0.2}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-text-primary">
                  {m.value}
                </div>
                <div className="text-xs text-text-dim mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
