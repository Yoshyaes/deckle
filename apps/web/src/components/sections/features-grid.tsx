import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { features } from '@/lib/constants';

export function FeaturesGrid() {
  return (
    <SectionWrapper id="features">
      <ScrollReveal>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">
            Everything you need
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            From simple HTML-to-PDF to batch processing and form filling.
            One API for every PDF workflow.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <ScrollReveal key={feature.title} delay={i * 0.05}>
              <Card hover className="p-5 h-full">
                <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center mb-3">
                  <Icon size={20} className="text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
