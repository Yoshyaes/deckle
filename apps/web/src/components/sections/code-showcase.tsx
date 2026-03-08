'use client';

import { SectionWrapper } from '@/components/ui/section-wrapper';
import { TabSwitcher } from '@/components/ui/tab-switcher';
import { CodeBlock } from '@/components/ui/code-block';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { codeExamples } from '@/lib/constants';

export function CodeShowcase() {
  const tabs = [
    {
      label: 'HTML',
      content: <CodeBlock code={codeExamples.html} language="typescript" />,
    },
    {
      label: 'React',
      content: <CodeBlock code={codeExamples.react} language="typescript" />,
    },
    {
      label: 'Template',
      content: <CodeBlock code={codeExamples.template} language="typescript" />,
    },
    {
      label: 'cURL',
      content: <CodeBlock code={codeExamples.curl} language="bash" />,
    },
  ];

  return (
    <SectionWrapper>
      <ScrollReveal>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">
            Works with your stack
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Send HTML, React components, or use stored templates. Pick the approach
            that fits your workflow.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="max-w-3xl mx-auto">
          <TabSwitcher tabs={tabs} />
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
