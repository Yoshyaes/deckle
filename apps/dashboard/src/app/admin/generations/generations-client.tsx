'use client';

import { useEffect, useState } from 'react';

interface Generation {
  id: string;
  user_id: string;
  user_email: string;
  input_type: string;
  status: string;
  pages: number | null;
  file_size_bytes: number | null;
  generation_time_ms: number | null;
  error: string | null;
  created_at: string;
}

export function GenerationsClient() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchGenerations = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (userIdFilter) params.set('userId', userIdFilter);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    fetch(`/api/admin/generations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setGenerations(data.data || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGenerations();
  }, [statusFilter, userIdFilter, offset]);

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
        </select>
        <input
          type="text"
          placeholder="Filter by User ID..."
          value={userIdFilter}
          onChange={(e) => { setUserIdFilter(e.target.value); setOffset(0); }}
          className="px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent w-64"
        />
        <div className="text-xs text-text-dim self-center">{total} generations total</div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-subtle overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface">
              <th className="text-left px-4 py-3 text-text-muted font-medium">ID</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">User</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Type</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Pages</th>
              <th className="text-right px-4 py-3 text-text-muted font-medium">Time</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Error</th>
              <th className="text-left px-4 py-3 text-text-muted font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-dim">Loading...</td>
              </tr>
            ) : generations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-dim">No generations found</td>
              </tr>
            ) : (
              generations.map((g) => (
                <tr key={g.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover/30">
                  <td className="px-4 py-3 font-mono text-text-muted text-xs">{g.id}</td>
                  <td className="px-4 py-3 text-text-primary text-xs">{g.user_email}</td>
                  <td className="px-4 py-3 text-text-muted">{g.input_type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${
                      g.status === 'completed' ? 'text-green-400' :
                      g.status === 'failed' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">{g.pages ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-text-muted">
                    {g.generation_time_ms ? `${(g.generation_time_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-3 text-red-400 text-xs max-w-[250px] truncate" title={g.error || ''}>
                    {g.error || '—'}
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {new Date(g.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between mt-4">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-3 py-1 rounded text-sm text-text-muted hover:text-text-primary disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-text-dim self-center">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="px-3 py-1 rounded text-sm text-text-muted hover:text-text-primary disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
