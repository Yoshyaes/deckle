import { SectionWrapper } from '@/components/ui/section-wrapper';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { comparisonRows } from '@/lib/constants';

export function Comparison() {
  return (
    <SectionWrapper>
      <ScrollReveal>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">
            Why developers choose DocuForge
          </h2>
          <p className="text-text-muted max-w-2xl mx-auto">
            Stop maintaining headless browsers. Start shipping PDFs.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-text-dim font-medium border-b border-border">
                  Feature
                </th>
                <th className="text-left px-4 py-3 text-accent font-semibold border-b border-border">
                  DocuForge
                </th>
                <th className="text-left px-4 py-3 text-text-dim font-medium border-b border-border">
                  Puppeteer DIY
                </th>
                <th className="text-left px-4 py-3 text-text-dim font-medium border-b border-border">
                  wkhtmltopdf
                </th>
                <th className="text-left px-4 py-3 text-text-dim font-medium border-b border-border">
                  Prince XML
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={i % 2 === 0 ? 'bg-bg' : 'bg-surface/50'}
                >
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {row.feature}
                  </td>
                  <td className="px-4 py-3 text-green font-medium">
                    {row.docuforge}
                  </td>
                  <td className="px-4 py-3 text-text-dim">{row.puppeteer}</td>
                  <td className="px-4 py-3 text-text-dim">{row.wkhtmltopdf}</td>
                  <td className="px-4 py-3 text-text-dim">{row.prince}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollReveal>
    </SectionWrapper>
  );
}
