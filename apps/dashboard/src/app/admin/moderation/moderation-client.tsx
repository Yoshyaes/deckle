'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { AlertTriangle, Check, X, FileText } from 'lucide-react';

interface Report {
  id: string;
  template_id: string;
  template_name: string | null;
  template_is_public: boolean;
  reason: 'spam' | 'malicious' | 'copyright' | 'inappropriate' | 'other';
  notes: string | null;
  status: 'open' | 'auto_actioned' | 'dismissed' | 'actioned';
  reporter_id: string;
  reporter_email: string | null;
  created_at: string;
}

interface Stats {
  open: number;
  autoActioned: number;
}

const REASON_LABELS: Record<Report['reason'], string> = {
  spam: 'Spam',
  malicious: 'Malicious',
  copyright: 'Copyright',
  inappropriate: 'Inappropriate',
  other: 'Other',
};

const REASON_COLOR: Record<Report['reason'], string> = {
  spam: 'bg-yellow-500/10 text-yellow-400',
  malicious: 'bg-red-500/10 text-red-400',
  copyright: 'bg-purple-500/10 text-purple-400',
  inappropriate: 'bg-orange-500/10 text-orange-400',
  other: 'bg-text-dim/10 text-text-dim',
};

export function ModerationClient() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/moderation/reports?stats=1');
      if (!res.ok) throw new Error('Failed to load reports');
      const data = await res.json();
      setReports(data.data || []);
      setStats(data.stats || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (
    report: Report,
    action: 'dismiss' | 'action',
    notes?: string,
  ) => {
    setBusyId(report.id);
    try {
      const res = await fetch(`/api/admin/moderation/reports/${report.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || `Failed to ${action} report`);
      }
      toast.success(
        action === 'dismiss' ? 'Report dismissed.' : 'Template unpublished and report closed.',
      );
      // Drop everything tied to that template from the visible queue;
      // the API closes every open report on the template in one shot.
      setReports((prev) => prev.filter((r) => r.template_id !== report.template_id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} report`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="text-text-muted text-sm">Loading reports…</div>;
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-1">
            <span className="font-semibold text-text-primary">{stats.open}</span> open
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 text-red-400 px-2 py-1">
            <AlertTriangle size={11} />
            <span className="font-semibold">{stats.autoActioned}</span> auto-hidden
          </span>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">Queue is clear. No open reports right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border bg-surface p-4 ${
                r.status === 'auto_actioned'
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-border-subtle'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={14} className="text-text-dim" />
                    <a
                      href={`/templates/${r.template_id}`}
                      className="text-sm font-semibold text-text-primary truncate hover:text-accent"
                    >
                      {r.template_name ?? r.template_id}
                    </a>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${REASON_COLOR[r.reason]}`}>
                      {REASON_LABELS[r.reason]}
                    </span>
                    {r.status === 'auto_actioned' && (
                      <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">
                        <AlertTriangle size={10} /> auto-hidden
                      </span>
                    )}
                    {r.status === 'open' && r.template_is_public === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-dim/10 text-text-dim">
                        unpublished
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-dim">
                    Reported by {r.reporter_email ?? r.reporter_id} ·{' '}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.notes && (
                    <p className="text-xs text-text-muted mt-2 whitespace-pre-wrap break-words">
                      {r.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => resolve(r, 'action')}
                    disabled={busyId === r.id}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-red-500/80 hover:bg-red-500 text-white text-[11px] font-semibold disabled:opacity-50"
                  >
                    <X size={11} /> Unpublish
                  </button>
                  <button
                    onClick={() => resolve(r, 'dismiss')}
                    disabled={busyId === r.id}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border border-border-subtle hover:border-border text-text-muted text-[11px] font-semibold disabled:opacity-50"
                  >
                    <Check size={11} /> Dismiss
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
