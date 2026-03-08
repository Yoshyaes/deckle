'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Copy, Check, X, Key } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
}

export function KeysClient({ initialKeys }: { initialKeys: ApiKey[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = (id: string, prefix: string) => {
    navigator.clipboard.writeText(prefix);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyNewKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Failed to create key');
      }
      const data = await res.json();
      setCreatedKey(data.key);
      setKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          createdAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          lastUsed: null,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreate = () => {
    setShowCreate(false);
    setCreatedKey(null);
    setKeyCopied(false);
    setNewKeyName('');
    setError(null);
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    setDeletingId(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/keys?id=${keyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Failed to delete key');
      }
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Create Key Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> Create Key
        </button>
      </div>

      {/* Create Key Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Key size={18} /> {createdKey ? 'Key Created' : 'Create API Key'}
              </h2>
              <button onClick={handleCloseCreate} className="text-text-dim hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            {createdKey ? (
              <div>
                <p className="text-xs text-text-muted mb-3">
                  Copy this key now. It will not be shown again.
                </p>
                <div className="flex items-center gap-2 bg-[#0D0D0F] border border-border-subtle rounded-lg p-3">
                  <code className="flex-1 text-sm font-mono text-accent break-all">
                    {createdKey}
                  </code>
                  <button
                    onClick={handleCopyNewKey}
                    className="shrink-0 p-1.5 rounded-md hover:bg-surface-hover text-text-dim hover:text-text-primary"
                  >
                    {keyCopied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleCloseCreate}
                  className="mt-4 w-full py-2 rounded-lg border border-border text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production, Staging"
                  className="w-full bg-[#0D0D0F] border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
                />
                {error && <p className="mt-2 text-xs text-red">{error}</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleCloseCreate}
                    className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && !showCreate && (
        <div className="mb-4 px-4 py-2 bg-red/10 border border-red/20 rounded-lg text-xs text-red">
          {error}
        </div>
      )}

      {/* Keys Table */}
      <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle grid grid-cols-[1fr_200px_120px_120px_60px] gap-4 text-xs font-medium text-text-dim">
          <span>Name</span>
          <span>Key</span>
          <span>Created</span>
          <span>Last Used</span>
          <span></span>
        </div>
        {keys.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-dim">
            No API keys yet. Create one to start generating PDFs.
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="px-5 py-3 border-b border-border-subtle grid grid-cols-[1fr_200px_120px_120px_60px] gap-4 items-center"
            >
              <span className="text-sm text-text-primary font-medium">
                {key.name}
              </span>
              <span className="font-mono text-xs text-text-muted flex items-center gap-2">
                {key.prefix}
                <button
                  onClick={() => handleCopy(key.id, key.prefix)}
                  className="text-text-dim hover:text-text-primary"
                >
                  {copiedId === key.id ? (
                    <Check size={12} />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </span>
              <span className="text-xs text-text-dim">{key.createdAt}</span>
              <span className="text-xs text-text-dim">
                {key.lastUsed || 'Never'}
              </span>
              <button
                onClick={() => handleDelete(key.id)}
                disabled={deletingId === key.id}
                className="text-text-dim hover:text-red transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
