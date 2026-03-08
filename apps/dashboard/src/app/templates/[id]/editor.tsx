'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import { Sidebar } from '@/components/sidebar';
import { Save, ArrowLeft, Eye, History, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';

interface Version {
  id: string;
  version: number;
  created_at: string;
}

interface TemplateEditorProps {
  template: {
    id: string;
    name: string;
    htmlContent: string;
    version: number;
  };
  usageCount: number;
  usageLimit: number;
}

export function TemplateEditor({ template, usageCount, usageLimit }: TemplateEditorProps) {
  const router = useRouter();
  const [html, setHtml] = useState(template.htmlContent);
  const [name, setName] = useState(template.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, html_content: html }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Failed to save');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.data || []);
      }
    } catch (err) {
      console.error('Operation failed:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const res = await fetch(`/api/templates/${template.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      });
      if (res.ok) {
        router.refresh();
        setShowHistory(false);
      }
    } catch (err) {
      console.error('Operation failed:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setRestoring(null);
    }
  };

  useEffect(() => {
    if (showHistory) loadVersions();
  }, [showHistory]);

  const hasChanges = html !== template.htmlContent || name !== template.name;

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={usageCount} usageLimit={usageLimit} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <Link
              href="/templates"
              className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors"
            >
              <ArrowLeft size={14} className="text-text-muted" />
            </Link>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent text-lg font-bold text-text-primary outline-none"
            />
            <span className="text-xs text-text-dim">v{template.version}</span>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red">{error}</span>}
            {saved && <span className="text-xs text-green">Saved!</span>}
            <button
              onClick={() => { setShowHistory(!showHistory); if (showHistory) setShowPreview(true); else setShowPreview(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showHistory
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <History size={14} /> History
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showPreview
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <Eye size={14} /> Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-xs font-semibold disabled:opacity-50 transition-opacity"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Editor + Preview Split */}
        <div className="flex-1 flex overflow-hidden">
          <div className={`${showPreview ? 'w-1/2' : 'flex-1'} border-r border-border-subtle flex flex-col`}>
            <div className="px-4 py-2 border-b border-border-subtle text-xs text-text-dim font-medium">
              HTML + Handlebars
            </div>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="flex-1 w-full bg-[#0D0D0F] text-text-muted font-mono text-sm p-4 outline-none resize-none"
              spellCheck={false}
            />
          </div>

          {showPreview && !showHistory && (
            <div className="w-1/2 bg-white flex flex-col">
              <div className="px-4 py-2 border-b border-gray-200 text-xs text-gray-500 font-medium">
                Preview (variables shown as placeholders)
              </div>
              <div className="flex-1 overflow-auto p-8">
                <div
                  className="text-black"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(html
                      .replace(
                        /\{\{(\w+(?:\.\w+)*)\}\}/g,
                        '<span style="color:#f97316;background:#fff7ed;padding:0 4px;border-radius:3px;font-family:monospace;font-size:0.85em">$1</span>',
                      )
                      .replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
                        '<div style="border:1px dashed #f97316;padding:8px;border-radius:4px;margin:4px 0"><span style="color:#f97316;font-size:0.75em;font-family:monospace">each: $1</span>$2</div>',
                      )
                      .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
                        '<div style="border:1px dashed #3b82f6;padding:8px;border-radius:4px;margin:4px 0"><span style="color:#3b82f6;font-size:0.75em;font-family:monospace">if: $1</span>$2</div>',
                      )),
                  }}
                />
              </div>
            </div>
          )}

          {showHistory && (
            <div className="w-80 border-l border-border-subtle flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
                <span className="text-xs font-medium text-text-primary">Version History</span>
                <button onClick={() => { setShowHistory(false); setShowPreview(true); }} className="p-1 rounded hover:bg-surface-hover">
                  <X size={12} className="text-text-muted" />
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {/* Current version */}
                <div className="px-4 py-3 border-b border-border-subtle bg-accent-soft/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent">v{template.version} (current)</span>
                  </div>
                  <span className="text-[10px] text-text-dim">Latest saved version</span>
                </div>

                {loadingVersions ? (
                  <div className="px-4 py-6 text-center text-xs text-text-dim">Loading...</div>
                ) : versions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-text-dim">No previous versions</div>
                ) : (
                  versions.map((v) => (
                    <div key={v.id} className="px-4 py-3 border-b border-border-subtle hover:bg-surface-hover transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-primary">v{v.version}</span>
                        <button
                          onClick={() => handleRestore(v.id)}
                          disabled={restoring === v.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-border text-text-muted hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw size={10} /> {restoring === v.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                      <span className="text-[10px] text-text-dim">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
