import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { sdks } from '@/lib/constants';

export function SdkGrid() {
  return (
    <SectionWrapper>
      <ScrollReveal>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">
            Your language. Your framework.
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            First-class SDKs for every major language, plus a REST API for everything else.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto items-stretch">
        {sdks.map((sdk, i) => (
          <ScrollReveal key={sdk.name} delay={i * 0.05} className="flex">
            <Card hover className="p-4 text-center flex flex-col items-center justify-between w-full">
              <div>
                <div
                  className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: sdk.color + '20', color: sdk.color }}
                >
                  {sdk.name.charAt(0)}
                </div>
                <div className="text-sm font-semibold text-text-primary mb-1">
                  {sdk.name}
                </div>
              </div>
              <code className="text-[10px] text-text-dim font-mono break-all">
                {sdk.package}
              </code>
            </Card>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={0.3}>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-text-dim">
          {['Next.js', 'Express', 'FastAPI', 'Django', 'Rails'].map((fw) => (
            <span
              key={fw}
              className="px-3 py-1 rounded-full border border-border"
            >
              {fw}
            </span>
          ))}
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
