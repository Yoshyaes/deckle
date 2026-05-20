import type { Metadata } from 'next';
import { SectionWrapper } from '@/components/ui/section-wrapper';

export const metadata: Metadata = {
  title: 'Status — DocuForge',
  description: 'Live operational status for the DocuForge PDF generation API.',
};

export default function StatusPage() {
  return (
    <SectionWrapper>
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight mb-2">
            Status
          </h1>
          <p className="text-text-muted">Live operational status for the DocuForge platform.</p>
        </header>

        <div className="bg-surface border border-border rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-green" aria-hidden="true" />
            <div className="text-base font-semibold text-text-primary">All systems operational</div>
          </div>
          <p className="text-sm text-text-muted">
            The public dashboard at{' '}
            <a
              href="https://status.getdocuforge.dev"
              className="text-accent hover:underline"
              rel="noopener noreferrer"
            >
              status.getdocuforge.dev
            </a>{' '}
            tracks API, dashboard, and queue worker uptime in real time. This page is a static
            snapshot; bookmark the status subdomain for live updates and incident history.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8">
          <h2 className="text-base font-semibold text-text-primary mb-3">Components</h2>
          <ul className="space-y-2 text-sm text-text-muted">
            <li className="flex justify-between">
              <span>API (api.getdocuforge.dev)</span>
              <span className="text-green">Operational</span>
            </li>
            <li className="flex justify-between">
              <span>Dashboard (app.getdocuforge.dev)</span>
              <span className="text-green">Operational</span>
            </li>
            <li className="flex justify-between">
              <span>Batch worker</span>
              <span className="text-green">Operational</span>
            </li>
            <li className="flex justify-between">
              <span>Webhook delivery</span>
              <span className="text-green">Operational</span>
            </li>
          </ul>
          <p className="text-xs text-text-dim mt-4">
            Subscribe to incident notifications on the live status page.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
