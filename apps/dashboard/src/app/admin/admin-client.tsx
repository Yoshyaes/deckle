'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/stat-card';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  totalGenerations: number;
  generationsThisMonth: number;
  generationsToday: number;
  activeUsersLast7d: number;
  errorRate: number;
  avgLatencyMs: number;
  totalStorageBytes: number;
  planDistribution: { plan: string; count: number }[];
  dailyGenerations: { date: string; count: number }[];
}

interface FunnelData {
  steps: { key: string; label: string; count: number; pct: number }[];
  dropOffs: { signupToKey: number; keyToFirstPdf: number; firstPdfToActive: number };
  planBreakdown: {
    plan: string;
    signedUp: number;
    createdApiKey: number;
    generatedFirstPdf: number;
    activeLast7d: number;
    activeLast30d: number;
  }[];
}

interface CohortData {
  cohorts: {
    cohortWeek: string;
    signups: number;
    retention: {
      w0: { count: number; pct: number };
      w1: { count: number; pct: number };
      w2: { count: number; pct: number };
      w4: { count: number; pct: number };
      w8: { count: number; pct: number };
    };
  }[];
}

interface ErrorBreakdownData {
  totalUsersWithFirstFailure: number;
  breakdown: {
    error: string;
    usersAffected: number;
    pct: number;
    lastOccurrence: string;
    sampleUserEmail: string;
  }[];
}

interface StuckUser {
  id: string;
  email: string;
  plan: string;
  created_at: string;
  key_count: number;
  generation_count: number;
  first_error_message: string | null;
  time_to_first_gen_sec: number | null;
}

interface ApiErrorsData {
  windowHours: number;
  totals: {
    totalErrors: number;
    usersAffected: number;
    serverErrors: number;
    authErrors: number;
    validationErrors: number;
    rateLimits: number;
    usageLimits: number;
  };
  grouped: {
    errorCode: string;
    path: string;
    usersAffected: number;
    occurrences: number;
    lastOccurrence: string;
    sampleMessage: string;
  }[];
  recent: unknown[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function cohortHeatColor(pct: number): string {
  if (pct >= 60) return 'bg-green-500/60 text-white';
  if (pct >= 40) return 'bg-green-500/40 text-green-100';
  if (pct >= 20) return 'bg-accent/50 text-white';
  if (pct > 0) return 'bg-accent/25 text-accent';
  return 'bg-border/40 text-text-dim';
}

export function AdminOverviewClient() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [cohorts, setCohorts] = useState<CohortData | null>(null);
  const [errors, setErrors] = useState<ErrorBreakdownData | null>(null);
  const [apiErrors, setApiErrors] = useState<ApiErrorsData | null>(null);
  const [stuck, setStuck] = useState<StuckUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()),
      fetch('/api/admin/funnel').then((r) => r.json()),
      fetch('/api/admin/cohorts').then((r) => r.json()),
      fetch('/api/admin/first-error-breakdown').then((r) => r.json()),
      fetch('/api/admin/api-errors?hours=168').then((r) => r.json()),
      fetch('/api/admin/users?stage=has_key_no_gen&limit=25').then((r) => r.json()),
    ])
      .then(([s, f, c, e, ae, u]) => {
        setStats(s);
        setFunnel(f);
        setCohorts(c);
        setErrors(e);
        setApiErrors(ae);
        setStuck(u.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-text-muted text-sm">Loading admin stats...</div>;
  }

  if (!stats) {
    return <div className="text-red-400 text-sm">Failed to load admin stats.</div>;
  }

  const maxDaily = Math.max(...stats.dailyGenerations.map((d) => d.count), 1);

  return (
    <div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <StatCard value={stats.totalUsers.toLocaleString()} label="Total Users" />
        <StatCard value={stats.generationsThisMonth.toLocaleString()} label="Generations This Month" />
        <StatCard value={stats.generationsToday.toLocaleString()} label="Generations Today" />
        <StatCard value={stats.activeUsersLast7d.toLocaleString()} label="Active Users (7d)" />
        <StatCard value={`${stats.errorRate}%`} label="Error Rate" />
        <StatCard
          value={stats.avgLatencyMs > 0 ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : '—'}
          label="Avg Latency"
        />
        <StatCard value={formatBytes(stats.totalStorageBytes)} label="Total Storage" />
        <StatCard value={stats.totalGenerations.toLocaleString()} label="All-Time Generations" />
      </div>

      {/* Activation Funnel */}
      {funnel && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Activation Funnel</h2>
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <div className="space-y-2">
              {funnel.steps.map((step, idx) => {
                const prev = idx > 0 ? funnel.steps[idx - 1].count : step.count;
                const dropOff = prev > 0 ? Math.round(((prev - step.count) / prev) * 1000) / 10 : 0;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className="w-44 text-xs text-text-muted">{step.label}</div>
                    <div className="flex-1 h-6 rounded bg-border/40 overflow-hidden relative">
                      <div
                        className="h-full bg-accent/80 transition-all"
                        style={{ width: `${step.pct}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold text-text-primary">
                        {step.count} · {step.pct}%
                      </span>
                    </div>
                    {idx > 0 && dropOff > 0 && (
                      <div className="w-20 text-[11px] text-red-400 text-right">
                        -{dropOff}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Cohort Retention */}
      {cohorts && cohorts.cohorts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Weekly Signup Cohorts — % of cohort who generated a PDF
          </h2>
          <div className="rounded-lg border border-border-subtle bg-surface p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-dim">
                  <th className="text-left font-medium py-2 pr-4">Cohort</th>
                  <th className="text-right font-medium py-2 pr-2">Signups</th>
                  <th className="text-center font-medium py-2 px-2">Week 0</th>
                  <th className="text-center font-medium py-2 px-2">Week 1</th>
                  <th className="text-center font-medium py-2 px-2">Week 2</th>
                  <th className="text-center font-medium py-2 px-2">Week 4</th>
                  <th className="text-center font-medium py-2 px-2">Week 8</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.cohorts.map((c) => (
                  <tr key={c.cohortWeek} className="border-t border-border-subtle">
                    <td className="py-2 pr-4 text-text-muted">{c.cohortWeek?.toString().slice(0, 10)}</td>
                    <td className="py-2 pr-2 text-right text-text-primary font-medium">{c.signups}</td>
                    {(['w0', 'w1', 'w2', 'w4', 'w8'] as const).map((w) => {
                      const bucket = c.retention[w];
                      return (
                        <td key={w} className="py-1 px-1 text-center">
                          <div
                            className={`inline-block px-2 py-1 rounded text-[11px] font-semibold min-w-[48px] ${cohortHeatColor(
                              bucket.pct,
                            )}`}
                            title={`${bucket.count} of ${c.signups}`}
                          >
                            {bucket.count > 0 ? `${bucket.pct}%` : '—'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* First-Time Error Breakdown */}
      {errors && errors.breakdown.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            First-Time Error Breakdown —{' '}
            <span className="text-text-muted font-normal">
              what killed {errors.totalUsersWithFirstFailure} users' first attempt
            </span>
          </h2>
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <div className="space-y-2">
              {errors.breakdown.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-xs py-1 border-b border-border-subtle last:border-b-0"
                >
                  <div className="flex-1 font-mono text-text-primary truncate" title={e.error}>
                    {e.error}
                  </div>
                  <div className="w-20 text-right text-text-muted">
                    {e.usersAffected} user{e.usersAffected === 1 ? '' : 's'}
                  </div>
                  <div className="w-16 text-right text-accent font-semibold">{e.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API errors (last 7 days) */}
      {apiErrors && apiErrors.totals.totalErrors > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            API Errors — last 7 days{' '}
            <span className="text-text-muted font-normal">
              ({apiErrors.totals.totalErrors} errors across {apiErrors.totals.usersAffected} users)
            </span>
          </h2>
          <div className="rounded-lg border border-border-subtle bg-surface p-4 mb-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              <div>
                <div className="text-[11px] text-text-dim uppercase tracking-wide">Auth (401)</div>
                <div className="text-lg font-bold text-text-primary">{apiErrors.totals.authErrors}</div>
              </div>
              <div>
                <div className="text-[11px] text-text-dim uppercase tracking-wide">Validation (400)</div>
                <div className="text-lg font-bold text-text-primary">{apiErrors.totals.validationErrors}</div>
              </div>
              <div>
                <div className="text-[11px] text-text-dim uppercase tracking-wide">Rate limit (429)</div>
                <div className="text-lg font-bold text-text-primary">{apiErrors.totals.rateLimits}</div>
              </div>
              <div>
                <div className="text-[11px] text-text-dim uppercase tracking-wide">Usage limit (403)</div>
                <div className="text-lg font-bold text-text-primary">{apiErrors.totals.usageLimits}</div>
              </div>
              <div>
                <div className="text-[11px] text-text-dim uppercase tracking-wide">Server (5xx)</div>
                <div className="text-lg font-bold text-red-400">{apiErrors.totals.serverErrors}</div>
              </div>
            </div>
          </div>
          {apiErrors.grouped.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="text-[11px] text-text-dim uppercase tracking-wide mb-2">
                Top (error, path) pairs
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-dim text-left">
                    <th className="py-2 font-medium">Error</th>
                    <th className="py-2 font-medium">Path</th>
                    <th className="py-2 font-medium text-right">Users</th>
                    <th className="py-2 font-medium text-right">Count</th>
                    <th className="py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {apiErrors.grouped.slice(0, 15).map((g, idx) => (
                    <tr key={idx} className="border-t border-border-subtle">
                      <td className="py-2 pr-2">
                        <div className="text-text-primary font-semibold">{g.errorCode}</div>
                        <div
                          className="text-text-dim text-[10px] truncate max-w-[240px]"
                          title={g.sampleMessage}
                        >
                          {g.sampleMessage}
                        </div>
                      </td>
                      <td className="py-2 pr-2 font-mono text-text-muted truncate max-w-[200px]" title={g.path}>
                        {g.path}
                      </td>
                      <td className="py-2 pr-2 text-right text-text-muted">{g.usersAffected}</td>
                      <td className="py-2 pr-2 text-right text-accent font-semibold">{g.occurrences}</td>
                      <td className="py-2 text-text-dim">
                        {new Date(g.lastOccurrence).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stuck Users */}
      {stuck.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Stuck Users —{' '}
            <span className="text-text-muted font-normal">
              have an API key but zero generations
            </span>
          </h2>
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-dim text-left">
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Plan</th>
                  <th className="py-2 font-medium">Signed up</th>
                  <th className="py-2 font-medium">Keys</th>
                  <th className="py-2 font-medium">Last error</th>
                  <th className="py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map((u) => (
                  <tr key={u.id} className="border-t border-border-subtle align-top">
                    <td className="py-2 text-text-primary">{u.email}</td>
                    <td className="py-2 text-text-muted capitalize">{u.plan}</td>
                    <td className="py-2 text-text-muted">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-text-muted">{u.key_count}</td>
                    <td
                      className="py-2 text-text-dim max-w-[260px] truncate"
                      title={u.first_error_message ?? undefined}
                    >
                      {u.first_error_message ? (
                        <span className="text-red">{u.first_error_message}</span>
                      ) : (
                        <span className="text-text-dim italic">no failed call yet</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-accent hover:text-orange-400 font-semibold"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan Distribution */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Plan Distribution</h2>
        <div className="flex gap-4">
          {stats.planDistribution.map((p) => (
            <div
              key={p.plan}
              className="flex-1 rounded-lg border border-border-subtle bg-surface p-4"
            >
              <div className="text-lg font-bold text-text-primary">{p.count}</div>
              <div className="text-xs text-text-muted capitalize">{p.plan}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Generations Chart */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Daily Generations (Last 30 Days)
        </h2>
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex items-end gap-[2px] h-32">
            {stats.dailyGenerations.map((d) => (
              <div
                key={d.date}
                className="flex-1 bg-accent/80 hover:bg-accent rounded-t transition-colors"
                style={{ height: `${Math.max((d.count / maxDaily) * 100, 2)}%` }}
                title={`${d.date}: ${d.count} generations`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-text-dim">
            <span>{stats.dailyGenerations[0]?.date}</span>
            <span>{stats.dailyGenerations[stats.dailyGenerations.length - 1]?.date}</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link
          href="/admin/users"
          className="flex-1 rounded-lg border border-border-subtle bg-surface p-4 hover:border-accent/50 transition-colors"
        >
          <div className="text-sm font-semibold text-text-primary">Manage Users</div>
          <div className="text-xs text-text-muted mt-1">View all users, change plans, manage accounts</div>
        </Link>
        <Link
          href="/admin/generations"
          className="flex-1 rounded-lg border border-border-subtle bg-surface p-4 hover:border-accent/50 transition-colors"
        >
          <div className="text-sm font-semibold text-text-primary">All Generations</div>
          <div className="text-xs text-text-muted mt-1">View every PDF generation across all users</div>
        </Link>
      </div>
    </div>
  );
}
