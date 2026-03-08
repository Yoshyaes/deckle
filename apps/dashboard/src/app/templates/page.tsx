import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { timeAgo } from '@/lib/utils';
import { getCurrentUser, getUserTemplates, getOverviewStats, getPlanLimit } from '@/lib/data';

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [tmpls, stats] = await Promise.all([
    getUserTemplates(user.id),
    getOverviewStats(user.id),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={stats.generationCount} usageLimit={getPlanLimit(user.plan)} />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            Templates
          </h1>
          <Link
            href="/templates/gallery"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold"
          >
            <Plus size={16} /> New Template
          </Link>
        </div>

        {tmpls.length === 0 ? (
          <div className="bg-surface border border-border rounded-[14px] p-12 text-center">
            <div className="text-4xl mb-4">&#9634;</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No templates yet
            </h3>
            <p className="text-sm text-text-muted mb-6 max-w-md mx-auto">
              Templates let you design reusable PDF layouts and merge dynamic data
              via the API. Create your first template to get started.
            </p>
            <Link
              href="/templates/gallery"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold"
            >
              <Plus size={16} /> Browse Starters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tmpls.map((tmpl) => (
              <Link
                key={tmpl.id}
                href={`/templates/${tmpl.id}`}
                className="bg-surface border border-border rounded-[14px] p-5 hover:border-accent/30 transition-colors"
              >
                <div className="text-sm font-semibold text-text-primary mb-1">
                  {tmpl.name}
                </div>
                <div className="text-xs text-text-dim">
                  v{tmpl.version} &middot; Updated {timeAgo(tmpl.updatedAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
