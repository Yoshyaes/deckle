import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { timeAgo } from '@/lib/utils';
import { getCurrentUser, getAllGenerations, getOverviewStats, getPlanLimit } from '@/lib/data';

export default async function GenerationsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const status = searchParams.status || 'all';
  const page = parseInt(searchParams.page || '1');
  const limit = 20;

  const [{ data: gens, total }, stats] = await Promise.all([
    getAllGenerations(user.id, { limit, offset: (page - 1) * limit, status }),
    getOverviewStats(user.id),
  ]);

  const filters = ['All', 'Completed', 'Failed'];

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={stats.generationCount} usageLimit={getPlanLimit(user.plan)} />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            Generations
          </h1>
          <div className="flex gap-2">
            {filters.map((f) => {
              const val = f.toLowerCase();
              const isActive = (val === 'all' && status === 'all') || val === status;
              return (
                <Link
                  key={f}
                  href={`/generations${val === 'all' ? '' : `?status=${val}`}`}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    isActive
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : 'border-border text-text-dim hover:text-text-muted'
                  }`}
                >
                  {f}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle grid grid-cols-[auto_1fr_100px_80px_80px_80px] gap-4 text-xs font-medium text-text-dim">
            <span className="w-2"></span>
            <span>ID</span>
            <span>Type</span>
            <span>Pages</span>
            <span>Time</span>
            <span className="text-right">Created</span>
          </div>
          {gens.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-text-dim">
              No generations found.
            </div>
          ) : (
            gens.map((gen, i) => (
              <Link
                key={gen.id}
                href={`/generations/${gen.id}`}
                className={`px-5 py-3 grid grid-cols-[auto_1fr_100px_80px_80px_80px] gap-4 items-center hover:bg-surface-hover/50 transition-colors ${
                  i < gens.length - 1 ? 'border-b border-border-subtle' : ''
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    gen.status === 'completed' ? 'bg-green' : gen.status === 'failed' ? 'bg-red' : 'bg-yellow-500'
                  }`}
                />
                <span className="font-mono text-xs text-text-primary font-medium truncate">
                  {gen.id}
                </span>
                <span className="text-xs text-text-dim">
                  {gen.templateId ? 'Template' : 'HTML'}
                </span>
                <span className="text-xs text-text-dim">
                  {gen.pages || '—'}
                </span>
                <span className="text-xs text-text-dim">
                  {gen.generationTimeMs ? `${(gen.generationTimeMs / 1000).toFixed(1)}s` : '—'}
                </span>
                <span className="text-xs text-text-dim text-right">
                  {timeAgo(gen.createdAt)}
                </span>
              </Link>
            ))
          )}
        </div>

        {total > limit && (
          <div className="flex justify-center gap-2 mt-4">
            {page > 1 && (
              <Link
                href={`/generations?page=${page - 1}${status !== 'all' ? `&status=${status}` : ''}`}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted"
              >
                Previous
              </Link>
            )}
            <span className="px-3 py-1.5 text-xs text-text-dim">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            {page * limit < total && (
              <Link
                href={`/generations?page=${page + 1}${status !== 'all' ? `&status=${status}` : ''}`}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
