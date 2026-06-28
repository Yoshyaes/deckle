'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  plan: string;
  role: string;
  created_at: string;
  generation_count: number;
  success_count: number;
  failure_count: number;
  key_count: number;
  last_generation: string | null;
  first_generation: string | null;
  time_to_first_gen_sec: number | null;
  days_since_last_gen: number | null;
  first_gen_status: string | null;
  first_error_message: string | null;
  used_input_types: string[] | null;
  has_created_template: boolean;
  health_score: number | null;
}

type Stage =
  | 'all'
  | 'signed_up_only'
  | 'has_key_no_gen'
  | 'has_gen'
  | 'active_7d'
  | 'at_risk'
  | 'churned_30d';

function timeAgo(date: string | null): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function healthBadge(score: number | null): { label: string; className: string } {
  if (score === null || score === undefined) return { label: '—', className: 'text-text-dim' };
  if (score >= 60) return { label: `${score}`, className: 'text-green-400 font-semibold' };
  if (score >= 30) return { label: `${score}`, className: 'text-yellow-400 font-semibold' };
  return { label: `${score}`, className: 'text-red-400 font-semibold' };
}

function successRate(u: User): string {
  if (u.generation_count === 0) return '—';
  const rate = Math.round((u.success_count / u.generation_count) * 100);
  return `${rate}%`;
}

export function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [stage, setStage] = useState<Stage>('all');

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (planFilter !== 'all') params.set('plan', planFilter);
    if (stage !== 'all') params.set('stage', stage);

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.data || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter, stage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const updatePlan = async (userId: string, newPlan: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: newPlan }),
    });
    fetchUsers();
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <form onSubmit={handleSearch} className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
        </form>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage)}
          className="px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="all">All stages</option>
          <option value="signed_up_only">Signed up only (no key, no gen)</option>
          <option value="has_key_no_gen">Has key, no generation</option>
          <option value="has_gen">Has generated</option>
          <option value="active_7d">Active last 7d</option>
          <option value="at_risk">At risk (quiet 7–30d)</option>
          <option value="churned_30d">Churned (silent 30d+)</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Count */}
      <div className="text-xs text-text-dim mb-3">{total} users total</div>

      {/* Table */}
      <div className="rounded-lg border border-border-subtle overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-border-subtle bg-surface">
              <th className="text-left px-4 py-3 text-text-muted font-medium">Email</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Plan</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Gens</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Success</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Keys</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium" title="0–100: key(+20), gen(+20), 80%+ success(+20), active 7d(+40), silent 30d(-30)">Health</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Time → 1st gen</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Signed Up</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Last Active</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">1st error</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-text-dim">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-text-dim">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-hover/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-text-primary hover:text-accent transition-colors"
                    >
                      {u.email}
                    </Link>
                    {u.has_created_template && (
                      <span
                        className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                        title="Has created a template"
                      >
                        tpl
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan}
                      onChange={(e) => updatePlan(u.id, e.target.value)}
                      className="bg-transparent border border-border-subtle rounded px-2 py-1 text-xs text-text-muted focus:outline-none focus:border-accent"
                    >
                      <option value="free">Free</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    {u.generation_count}
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">{successRate(u)}</td>
                  <td className="px-4 py-3 text-right text-text-muted">{u.key_count}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    {(() => { const b = healthBadge(u.health_score); return <span className={b.className}>{b.label}</span>; })()}
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {formatDuration(u.time_to_first_gen_sec)}
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {timeAgo(u.last_generation)}
                  </td>
                  <td
                    className="px-4 py-3 text-text-dim text-xs max-w-[200px] truncate"
                    title={u.first_error_message || ''}
                  >
                    {u.first_error_message || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-xs text-accent hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
