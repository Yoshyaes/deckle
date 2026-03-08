'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1a1a2e; }
  h1 { color: #f97316; margin-bottom: 16px; }
  .card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { background: #f97316; color: white; padding: 10px 16px; text-align: left; font-size: 13px; }
  td { padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  tr:nth-child(even) { background: #fafafa; }
</style>
</head>
<body>
  <h1>DocuForge Playground</h1>
  <p>Edit this HTML to see your PDF come to life. Try modifying the styles, adding tables, or building a complete document layout.</p>

  <div class="card">
    <strong>Quick Tips:</strong>
    <ul>
      <li>Use <code>@page</code> rules for page-level settings</li>
      <li>Add <code>page-break-before: always</code> for multi-page documents</li>
      <li>Headers and footers support <code>{{pageNumber}}</code> and <code>{{totalPages}}</code></li>
    </ul>
  </div>

  <table>
    <thead>
      <tr><th>Feature</th><th>Status</th><th>Notes</th></tr>
    </thead>
    <tbody>
      <tr><td>CSS Grid</td><td>Supported</td><td>Full CSS3 grid layout</td></tr>
      <tr><td>Flexbox</td><td>Supported</td><td>All flex properties work</td></tr>
      <tr><td>Custom Fonts</td><td>Supported</td><td>Upload WOFF2, TTF, OTF</td></tr>
      <tr><td>Images</td><td>Supported</td><td>URL or base64 inline</td></tr>
    </tbody>
  </table>
</body>
</html>`;

export default function PlaygroundPage() {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, format, orientation }),
      });
      const data = await res.json();
      if (data.url) {
        setPdfUrl(data.url);
      } else {
        setError(data.error?.message || 'Generation failed');
      }
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
          <h1 className="text-[16px] font-bold text-text-primary tracking-tight">
            Playground
          </h1>
          <div className="flex items-center gap-3">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary text-xs"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary text-xs"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={loading || !html.trim()}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>

        {/* Split panes */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="w-1/2 flex flex-col border-r border-border">
            <div className="px-4 py-2 border-b border-border bg-surface">
              <span className="text-xs text-text-dim font-medium">HTML Editor</span>
            </div>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
              className="flex-1 p-4 bg-background text-text-primary font-mono text-[13px] leading-relaxed resize-none outline-none"
              placeholder="Enter your HTML here..."
            />
          </div>

          {/* Preview */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-surface">
              <span className="text-xs text-text-dim font-medium">PDF Preview</span>
            </div>
            <div className="flex-1 bg-[#525659] flex items-center justify-center">
              {error && (
                <div className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-4 py-3 mx-6">
                  {error}
                </div>
              )}
              {!pdfUrl && !error && (
                <div className="text-gray-400 text-sm">
                  Click "Generate PDF" to see a preview
                </div>
              )}
              {pdfUrl && (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title="PDF Preview"
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
