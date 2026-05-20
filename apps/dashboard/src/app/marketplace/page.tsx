'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useToast } from '@/components/ui/toast';
import { Search, Download, Eye, ExternalLink, Flag } from 'lucide-react';

interface MarketplaceTemplate {
  id: string;
  name: string;
  version: number;
  created_at: string;
  updated_at: string;
}

type ReportReason = 'spam' | 'malicious' | 'copyright' | 'inappropriate' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'spam', label: 'Spam or low effort', hint: 'Repetitive, nonsense, or filler content.' },
  { value: 'malicious', label: 'Malicious / unsafe', hint: 'Tries to exploit the renderer or includes harmful content.' },
  { value: 'copyright', label: 'Copyright violation', hint: 'Uses content the publisher does not have rights to.' },
  { value: 'inappropriate', label: 'Inappropriate', hint: "Doesn't belong on a public marketplace." },
  { value: 'other', label: 'Something else', hint: 'Tell us what in the notes.' },
];

export default function MarketplacePage() {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);
  const [reporting, setReporting] = useState<MarketplaceTemplate | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [reportNotes, setReportNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/marketplace');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('Operation failed:', err);
      toast.error('Could not load the marketplace. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (id: string) => {
    setCloning(id);
    try {
      const res = await fetch(`/api/marketplace/${id}/clone`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/templates/${data.id}`);
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Clone failed');
      }
    } catch (err) {
      console.error('Operation failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Could not clone this template. Try again.',
      );
    } finally {
      setCloning(null);
    }
  };

  const openReport = (tmpl: MarketplaceTemplate) => {
    setReporting(tmpl);
    setReportReason('spam');
    setReportNotes('');
  };

  const submitReport = async () => {
    if (!reporting) return;
    setSubmittingReport(true);
    try {
      const res = await fetch(`/api/marketplace/${reporting.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          notes: reportNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auto_actioned) {
          toast.success(
            'Thanks. This template hit the auto-review threshold and is hidden pending moderator review.',
          );
          // Drop the template from the visible list immediately.
          setTemplates((prev) => prev.filter((t) => t.id !== reporting.id));
        } else {
          toast.success('Thanks — a moderator will review this template.');
        }
        setReporting(null);
      } else if (res.status === 409) {
        toast.error('You already reported this template. A moderator will review it.');
        setReporting(null);
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Could not submit report');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit report. Try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={0} usageLimit={100} />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Template Marketplace</h1>
              <p className="text-sm text-text-muted mt-1">
                Browse and clone community templates
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-accent/50"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-text-dim">Loading templates...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-dim">No public templates available yet.</p>
              <p className="text-xs text-text-dim mt-2">
                Publish your templates to share them with the community.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="rounded-xl border border-border-subtle bg-surface p-5 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-text-primary text-sm">{tmpl.name}</h3>
                    <span className="text-[10px] text-text-dim bg-surface-hover px-2 py-0.5 rounded">
                      v{tmpl.version}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim mb-4">
                    Updated {new Date(tmpl.updated_at).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleClone(tmpl.id)}
                      disabled={cloning === tmpl.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Download size={12} />
                      {cloning === tmpl.id ? 'Cloning...' : 'Clone'}
                    </button>
                    <button
                      onClick={() => openReport(tmpl)}
                      title="Report this template"
                      aria-label="Report this template"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-text-dim hover:text-red-400 hover:border-red-500/40 transition-colors"
                    >
                      <Flag size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Report modal */}
      {reporting && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingReport) setReporting(null);
          }}
        >
          <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Report template</h3>
                <p className="text-xs text-text-dim mt-0.5 truncate max-w-[300px]">
                  {reporting.name}
                </p>
              </div>
              <button
                onClick={() => !submittingReport && setReporting(null)}
                className="text-text-dim hover:text-text-primary text-xs"
                aria-label="Close"
              >
                Esc
              </button>
            </div>
            <p className="text-xs text-text-dim mb-3">
              Tell us what's wrong with this template. A moderator will review it. After three
              independent reports, the template is auto-hidden pending review.
            </p>
            <div className="space-y-1.5 mb-3">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    reportReason === r.value
                      ? 'border-accent/60 bg-accent/5'
                      : 'border-border-subtle hover:border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reportReason === r.value}
                    onChange={() => setReportReason(r.value)}
                    className="mt-0.5"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-text-primary">{r.label}</div>
                    <div className="text-text-dim">{r.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            <label className="block text-xs text-text-muted mb-1" htmlFor="report-notes">
              Notes (optional)
            </label>
            <textarea
              id="report-notes"
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value.slice(0, 1000))}
              placeholder="Anything you want a moderator to know"
              rows={3}
              className="w-full rounded-lg bg-surface-hover border border-border text-xs text-text-primary p-2 outline-none focus:border-accent/50 resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setReporting(null)}
                disabled={submittingReport}
                className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={submittingReport}
                className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {submittingReport ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
