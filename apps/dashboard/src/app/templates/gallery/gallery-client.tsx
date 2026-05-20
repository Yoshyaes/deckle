'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DOMPurify from 'dompurify';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { ArrowLeft, Copy, Eye, FileText, Receipt, BarChart3, Award, Package } from 'lucide-react';

interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  sample_data: Record<string, unknown>;
}

const categoryIcons: Record<string, React.ReactNode> = {
  finance: <Receipt size={20} />,
  business: <BarChart3 size={20} />,
  marketing: <Award size={20} />,
  legal: <FileText size={20} />,
};

const categoryColors: Record<string, string> = {
  finance: 'from-emerald-500 to-teal-600',
  business: 'from-blue-500 to-indigo-600',
  marketing: 'from-purple-500 to-pink-600',
  legal: 'from-amber-500 to-orange-600',
};

export function StarterGallery({ templates }: { templates: StarterTemplate[] }) {
  const router = useRouter();
  const toast = useToast();
  const [preview, setPreview] = useState<StarterTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async (tmpl: StarterTemplate) => {
    setPreview(tmpl);
    setPreviewHtml(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${apiUrl}/v1/starter-templates/${tmpl.slug}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html_content);
      }
    } catch (err) {
      console.error('Operation failed:', err);
      toast.error('Could not load this starter template. Try again or refresh the page.');
    }
  };

  const handleClone = async (tmpl: StarterTemplate) => {
    setCloning(tmpl.slug);
    setError(null);
    try {
      // Fetch full HTML if we don't have it
      let htmlContent = previewHtml;
      if (!htmlContent) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/v1/starter-templates/${tmpl.slug}`);
        if (res.ok) {
          const data = await res.json();
          htmlContent = data.html_content;
        }
      }
      if (!htmlContent) throw new Error('Could not load template');

      const res = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tmpl.name,
          html_content: htmlContent,
          sample_data: tmpl.sample_data,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error?.message ||
            "Couldn't clone — you may be over your template limit, or there was a network issue.",
        );
      }

      const data = await res.json();
      router.push(`/templates/${data.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't clone — you may be over your template limit, or there was a network issue.",
      );
    } finally {
      setCloning(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/templates"
          className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft size={14} className="text-text-muted" />
        </Link>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
          Starter Templates
        </h1>
      </div>

      <p className="text-sm text-text-muted mb-6 max-w-lg">
        Clone a pre-built template to your account and customize it. Each template includes
        sample data you can use for testing.
      </p>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red/10 border border-red/20 rounded-lg text-xs text-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tmpl) => (
          <div
            key={tmpl.slug}
            className="bg-surface border border-border rounded-[14px] overflow-hidden hover:border-accent/30 transition-colors"
          >
            {/* Color banner */}
            <div className={`h-24 bg-gradient-to-br ${categoryColors[tmpl.category] || 'from-gray-500 to-gray-600'} flex items-center justify-center text-white/80`}>
              {categoryIcons[tmpl.category] || <FileText size={20} />}
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-text-primary">{tmpl.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover text-text-dim font-medium capitalize">
                  {tmpl.category}
                </span>
              </div>
              <p className="text-xs text-text-muted mb-4 line-clamp-2">{tmpl.description}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => handlePreview(tmpl)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <Eye size={12} /> Preview
                </button>
                <button
                  onClick={() => handleClone(tmpl)}
                  disabled={cloning === tmpl.slug}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-xs font-semibold disabled:opacity-50 transition-opacity"
                >
                  <Copy size={12} /> {cloning === tmpl.slug ? 'Cloning...' : 'Use Template'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.name ?? ''}
        description={preview?.description}
        footer={
          preview ? (
            <button
              type="button"
              onClick={() => handleClone(preview)}
              disabled={cloning === preview.slug}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
            >
              <Copy size={12} /> {cloning === preview.slug ? 'Cloning…' : 'Use template'}
            </button>
          ) : null
        }
      >
        <div className="max-h-[60vh] overflow-auto bg-white text-black p-6 rounded-md">
          {previewHtml ? (
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  previewHtml
                    .replace(
                      /\{\{([\w.]+)\}\}/g,
                      '<span style="color:#f97316;background:#fff7ed;padding:0 4px;border-radius:3px;font-family:monospace;font-size:0.85em">$1</span>',
                    )
                    .replace(
                      /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
                      '<div style="border:1px dashed #f97316;padding:8px;border-radius:4px;margin:4px 0"><span style="color:#f97316;font-size:0.75em;font-family:monospace">each: $1</span>$2</div>',
                    )
                    .replace(
                      /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
                      '<div style="border:1px dashed #3b82f6;padding:8px;border-radius:4px;margin:4px 0"><span style="color:#3b82f6;font-size:0.75em;font-family:monospace">if: $1</span>$2</div>',
                    ),
                ),
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Loading preview…
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
