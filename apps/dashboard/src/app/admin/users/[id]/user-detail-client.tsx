'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/stat-card';

interface UserDetail {
  user: {
    id: string;
    email: string;
    plan: string;
    role: string;
    createdAt: string;
  };
  generations: {
    id: string;
    inputType: string;
    status: string;
    pages: number | null;
    generationTimeMs: number | null;
    fileSizeBytes: number | null;
    error: string | null;
    createdAt: string;
  }[];
  keys: {
    id: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: string | null;
    createdAt: string;
  }[];
  templates: {
    id: string;
    name: string;
    version: number;
    isPublic: boolean;
    createdAt: string;
  }[];
  usage: {
    totalGenerations: number;
    totalPages: number;
    totalBytes: number;
    completed: number;
    failed: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function UserDetailClient({ userId }: { userId: string }) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBreakdown, setErrorBreakdown] = useState<{
    error: string;
    count: number;
    percentage: number;
    last_occurrence: string;
  }[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d?.usage?.failed > 0) {
          fetch(`/api/admin/users/${userId}/errors`)
            .then((r) => r.json())
            .then((e) => setErrorBreakdown(e.data));
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="text-text-muted text-sm">Loading...</div>;
  if (!data?.user) return <div className="text-red-400 text-sm">User not found.</div>;

  const { user, generations, keys, templates, usage } = data;
  const successRate = usage.totalGenerations > 0
    ? Math.round((usage.completed / (usage.completed + usage.failed)) * 1000) / 10
    : 0;

  const updatePlan = async (plan: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    router.refresh();
    // Refetch
    const r = await fetch(`/api/admin/users/${userId}`);
    setData(await r.json());
  };

  const deleteUser = async () => {
    if (!confirm(`Delete ${user.email}? This will delete all their data.`)) return;
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    router.push('/admin/users');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/users" className="text-xs text-text-dim hover:text-text-muted mb-1 block">
            &larr; Back to users
          </Link>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            {user.email}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${
              user.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-surface text-text-dim'
            }`}>
              {user.role}
            </span>
            <span className="text-xs text-text-dim">
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={user.plan}
            onChange={(e) => updatePlan(e.target.value)}
            className="bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button
            onClick={deleteUser}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
          >
            Delete User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard value={usage.totalGenerations.toLocaleString()} label="Total Generations" />
        <StatCard value={usage.totalPages.toLocaleString()} label="Total Pages" />
        <StatCard value={formatBytes(usage.totalBytes)} label="Storage Used" />
        <StatCard value={`${successRate}%`} label="Success Rate" />
      </div>

      {/* Error Breakdown */}
      {errorBreakdown && errorBreakdown.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-red-400 mb-3">
            Error Breakdown ({errorBreakdown.reduce((s, e) => s + e.count, 0)} failures)
          </h2>
          <div className="rounded-lg border border-red-500/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface">
                  <th className="text-left px-4 py-2 text-text-muted font-medium">Error</th>
                  <th className="text-right px-4 py-2 text-text-muted font-medium">Count</th>
                  <th className="text-right px-4 py-2 text-text-muted font-medium">%</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {errorBreakdown.map((e, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2 text-red-400 text-xs max-w-[400px]" title={e.error}>
                      <span className="line-clamp-2">{e.error}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-text-primary font-mono">{e.count}</td>
                    <td className="px-4 py-2 text-right text-text-muted">{e.percentage}%</td>
                    <td className="px-4 py-2 text-text-dim text-xs">
                      {new Date(e.last_occurrence).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          API Keys ({keys.length})
        </h2>
        <div className="rounded-lg border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface">
                <th className="text-left px-4 py-2 text-text-muted font-medium">Name</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Prefix</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Last Used</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2 text-text-primary">{k.name}</td>
                  <td className="px-4 py-2 font-mono text-text-muted text-xs">{k.keyPrefix}...</td>
                  <td className="px-4 py-2 text-text-dim text-xs">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-text-dim text-xs">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-text-dim">No API keys</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Templates */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Templates ({templates.length})
        </h2>
        <div className="rounded-lg border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface">
                <th className="text-left px-4 py-2 text-text-muted font-medium">Name</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Version</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Public</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2 text-text-primary">{t.name}</td>
                  <td className="px-4 py-2 text-text-muted">v{t.version}</td>
                  <td className="px-4 py-2 text-text-dim text-xs">{t.isPublic ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 text-text-dim text-xs">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-text-dim">No templates</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Generations */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Recent Generations ({generations.length})
        </h2>
        <div className="rounded-lg border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface">
                <th className="text-left px-4 py-2 text-text-muted font-medium">ID</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Type</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Status</th>
                <th className="text-right px-4 py-2 text-text-muted font-medium">Pages</th>
                <th className="text-right px-4 py-2 text-text-muted font-medium">Time</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Error</th>
                <th className="text-left px-4 py-2 text-text-muted font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {generations.map((g) => (
                <tr key={g.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2 font-mono text-text-muted text-xs">{g.id}</td>
                  <td className="px-4 py-2 text-text-muted">{g.inputType}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs ${g.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-text-muted">{g.pages ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-text-muted">
                    {g.generationTimeMs ? `${(g.generationTimeMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-2 text-red-400 text-xs max-w-[200px] truncate" title={g.error || ''}>
                    {g.error || '—'}
                  </td>
                  <td className="px-4 py-2 text-text-dim text-xs">
                    {new Date(g.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {generations.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-text-dim">No generations</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
