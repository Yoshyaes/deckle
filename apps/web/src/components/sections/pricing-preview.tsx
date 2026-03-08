import { Check } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

const freeFeatures = [
  '100 PDFs per month',
  'All PDF generation features',
  'All SDK languages',
  'Template engine access',
  'PDF tools (merge, split, protect)',
  'Community support',
];

export function PricingPreview() {
  return (
    <SectionWrapper id="pricing">
      <ScrollReveal>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">
            Start generating PDFs for free
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            No credit card required. Upgrade when you need more volume.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="max-w-md mx-auto">
          <Card className="p-8 relative overflow-hidden">
            {/* Glow accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />

            <div className="text-center mb-6">
              <div className="text-sm font-medium text-accent mb-2">Free Tier</div>
              <div className="text-5xl font-bold text-text-primary mb-1">$0</div>
              <div className="text-sm text-text-dim">per month, forever</div>
            </div>

            <ul className="space-y-3 mb-8">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-text-muted">
                  <Check size={16} className="text-green flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button className="w-full" size="lg" href="https://app.docuforge.dev/sign-up">
              Get Your API Key
            </Button>

            <p className="text-center text-xs text-text-dim mt-4">
              Need more? Plans start at $29/month for 10,000 PDFs.
            </p>
          </Card>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
