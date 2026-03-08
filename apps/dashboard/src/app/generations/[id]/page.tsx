import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import {
  getCurrentUser,
  getGenerationById,
  getOverviewStats,
  getPlanLimit,
} from '@/lib/data';
import { ArrowLeft, Download, ExternalLink, FileText, Clock, Layers, HardDrive } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function GenerationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [gen, stats] = await Promise.all([
    getGenerationById(user.id, params.id),
    getOverviewStats(user.id),
  ]);

  if (!gen) notFound();

  const isCompleted = gen.status === 'completed';
  const isFailed = gen.status === 'failed';

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={stats.generationCount} usageLimit={getPlanLimit(user.plan)} />
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/generations"
            className="p-1.5 rounded-lg border border-border hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft size={16} className="text-text-muted" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
              Generation Details
            </h1>
            <span className="font-mono text-xs text-text-dim">{gen.id}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                isCompleted
                  ? 'bg-green/10 text-green'
                  : isFailed
                  ? 'bg-red/10 text-red'
                  : 'bg-yellow-500/10 text-yellow-500'
              }`}
            >
              {gen.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="lg:col-span-1 space-y-4">
            {/* Metadata cards */}
            <div className="bg-surface border border-border rounded-[14px] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-text-primary">Details</h2>

              <div className="flex items-center gap-3">
                <FileText size={14} className="text-text-dim" />
                <div>
                  <div className="text-xs text-text-dim">Input Type</div>
                  <div className="text-sm text-text-primary font-medium capitalize">{gen.inputType}</div>
                </div>
              </div>

              {gen.pages && (
                <div className="flex items-center gap-3">
                  <Layers size={14} className="text-text-dim" />
                  <div>
                    <div className="text-xs text-text-dim">Pages</div>
                    <div className="text-sm text-text-primary font-medium">{gen.pages}</div>
                  </div>
                </div>
              )}

              {gen.fileSizeBytes && (
                <div className="flex items-center gap-3">
                  <HardDrive size={14} className="text-text-dim" />
                  <div>
                    <div className="text-xs text-text-dim">File Size</div>
                    <div className="text-sm text-text-primary font-medium">{formatBytes(gen.fileSizeBytes)}</div>
                  </div>
                </div>
              )}

              {gen.generationTimeMs && (
                <div className="flex items-center gap-3">
                  <Clock size={14} className="text-text-dim" />
                  <div>
                    <div className="text-xs text-text-dim">Generation Time</div>
                    <div className="text-sm text-text-primary font-medium">
                      {(gen.generationTimeMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                </div>
              )}

              {gen.templateId && (
                <div>
                  <div className="text-xs text-text-dim">Template</div>
                  <div className="text-sm text-text-primary font-mono">{gen.templateId}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-text-dim">Created</div>
                <div className="text-sm text-text-primary">{formatDate(gen.createdAt)}</div>
              </div>
            </div>

            {/* Error message if failed */}
            {isFailed && gen.error && (
              <div className="bg-red/5 border border-red/20 rounded-[14px] p-5">
                <h2 className="text-sm font-semibold text-red mb-2">Error</h2>
                <p className="text-xs text-red/80 font-mono whitespace-pre-wrap">{gen.error}</p>
              </div>
            )}

            {/* Actions */}
            {isCompleted && gen.pdfUrl && (
              <div className="flex gap-2">
                <a
                  href={gen.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold"
                >
                  <ExternalLink size={14} />
                  Open PDF
                </a>
                <a
                  href={gen.pdfUrl}
                  download={`${gen.id}.pdf`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover transition-colors"
                >
                  <Download size={14} />
                  Download
                </a>
              </div>
            )}
          </div>

          {/* Right: PDF Preview */}
          <div className="lg:col-span-2">
            {isCompleted && gen.pdfUrl ? (
              <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
                <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Preview</span>
                  <a
                    href={gen.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    Open in new tab
                  </a>
                </div>
                <iframe
                  src={gen.pdfUrl}
                  className="w-full bg-white"
                  style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
                  title="PDF Preview"
                />
              </div>
            ) : isFailed ? (
              <div className="bg-surface border border-border rounded-[14px] flex items-center justify-center" style={{ height: '400px' }}>
                <p className="text-sm text-text-dim">Generation failed — no PDF available.</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-[14px] flex items-center justify-center" style={{ height: '400px' }}>
                <p className="text-sm text-text-dim">PDF is still processing...</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
