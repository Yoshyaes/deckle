import { Code2, Send, FileDown } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

const steps = [
  {
    icon: Code2,
    number: '01',
    title: 'Write Your Template',
    description:
      'Use HTML, React components, or Handlebars templates. Design exactly the PDF you want with the tools you already know.',
  },
  {
    icon: Send,
    number: '02',
    title: 'Call the API',
    description:
      'One POST request with your content. We handle browser rendering, fonts, page layout, and storage.',
  },
  {
    icon: FileDown,
    number: '03',
    title: 'Get Your PDF',
    description:
      'Receive a pixel-perfect PDF back in milliseconds. A CDN URL, ready to download, email, or embed.',
  },
];

export function HowItWorks() {
  return (
    <SectionWrapper>
      <ScrollReveal>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">
            Three steps to your first PDF
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            No headless browsers to manage. No complex setup. Just your content
            and one API call.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid sm:grid-cols-3 gap-8">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <ScrollReveal key={step.number} delay={i * 0.1}>
              <div className="relative bg-surface border border-border rounded-[14px] p-6 text-center">
                {/* Step number */}
                <div className="text-xs font-mono text-accent mb-4">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-accent-soft mx-auto mb-4 flex items-center justify-center">
                  <Icon size={24} className="text-accent" />
                </div>

                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {step.description}
                </p>

                {/* Connector arrow (not on last) */}
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-1/2 -right-4 text-text-dim">
                    &rarr;
                  </div>
                )}
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
