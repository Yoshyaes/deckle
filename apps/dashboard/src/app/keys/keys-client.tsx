'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Copy, Check, Key } from 'lucide-react';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
}

export function KeysClient({ initialKeys }: { initialKeys: ApiKey[] }) {
  const router = useRouter();
  const toast = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

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
        throw new Error(
          data?.error?.message ||
            "Couldn't create the key. Refresh and try again — if this persists, you may be signed out.",
        );
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
      setError(
        err instanceof Error ? err.message : "Couldn't create the key. Refresh and try again.",
      );
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
    setDeletingId(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/keys?id=${keyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error?.message ||
            "Couldn't revoke that key. It may have already been deleted — refresh the page.",
        );
      }
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      toast.success('API key revoked.');
      setRevokeTarget(null);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't revoke that key. It may have already been deleted — refresh the page.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Create Key Button */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create Key
        </Button>
      </div>

      {/* Create Key Modal */}
      <Dialog
        open={showCreate}
        onClose={handleCloseCreate}
        title={createdKey ? 'Key created' : 'Create API key'}
        description={
          createdKey
            ? 'Copy this key now. It will not be shown again.'
            : 'Name this key so you can identify which service uses it later.'
        }
        blocking={createdKey !== null}
        footer={
          createdKey ? (
            <Button type="button" onClick={handleCloseCreate} size="md">
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleCloseCreate}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </>
          )
        }
      >
        {createdKey ? (
          <div>
            <div className="flex items-center gap-2 bg-[#0D0D0F] border border-border-subtle rounded-lg p-3">
              <code className="flex-1 text-sm font-mono text-accent break-all">
                {createdKey}
              </code>
              <button
                type="button"
                onClick={handleCopyNewKey}
                aria-label="Copy API key"
                className="shrink-0 p-1.5 rounded-md hover:bg-surface-hover text-text-dim hover:text-text-primary"
              >
                {keyCopied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <Input
            id="new-key-name"
            label="Key name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. Production, Staging"
            error={error ?? undefined}
          />
        )}
      </Dialog>

      {/* Error banner */}
      {error && !showCreate && (
        <div className="mb-4 px-4 py-2 bg-red/10 border border-red/20 rounded-lg text-xs text-red">
          {error}
        </div>
      )}

      {/* Keys Table */}
      <Card>
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
                onClick={() => setRevokeTarget(key)}
                disabled={deletingId === key.id}
                aria-label={`Revoke API key ${key.name}`}
                className="text-text-dim hover:text-red transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </Card>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => (deletingId ? null : setRevokeTarget(null))}
        onConfirm={() => revokeTarget && handleDelete(revokeTarget.id)}
        title="Revoke API key?"
        description={
          revokeTarget
            ? `“${revokeTarget.name}” will stop working immediately. Any service using this key will start receiving 401 errors. This cannot be undone.`
            : undefined
        }
        confirmLabel="Revoke key"
        destructive
        busy={deletingId !== null}
      />
    </>
  );
}
