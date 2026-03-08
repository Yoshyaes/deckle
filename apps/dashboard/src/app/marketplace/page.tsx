'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Search, Download, Eye, ExternalLink } from 'lucide-react';

interface MarketplaceTemplate {
  id: string;
  name: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export default function MarketplacePage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/marketplace');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('Operation failed:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (id: string) => {
    setCloning(id);
    try {
      const res = await fetch(`/api/marketplace/${id}/clone`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/templates/${data.id}`);
      }
    } catch (err) {
      console.error('Operation failed:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setCloning(null);
    }
  };

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={0} usageLimit={100} />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Template Marketplace</h1>
              <p className="text-sm text-text-muted mt-1">
                Browse and clone community templates
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-accent/50"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-text-dim">Loading templates...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-dim">No public templates available yet.</p>
              <p className="text-xs text-text-dim mt-2">
                Publish your templates to share them with the community.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="rounded-xl border border-border-subtle bg-surface p-5 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-text-primary text-sm">{tmpl.name}</h3>
                    <span className="text-[10px] text-text-dim bg-surface-hover px-2 py-0.5 rounded">
                      v{tmpl.version}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim mb-4">
                    Updated {new Date(tmpl.updated_at).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleClone(tmpl.id)}
                      disabled={cloning === tmpl.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Download size={12} />
                      {cloning === tmpl.id ? 'Cloning...' : 'Clone'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
