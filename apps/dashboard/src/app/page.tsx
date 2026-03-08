import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import { StatCard } from '@/components/stat-card';
import { GenerationTable } from '@/components/generation-table';
import { UsageChart } from '@/components/usage-chart';
import { ApiKeyDisplay } from '@/components/api-key-display';
import { timeAgo } from '@/lib/utils';
import {
  getCurrentUser,
  getOverviewStats,
  getRecentGenerations,
  getUserApiKeys,
  getDailyUsage,
  getPlanLimit,
} from '@/lib/data';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [stats, recentGens, keys, chartData] = await Promise.all([
    getOverviewStats(user.id),
    getRecentGenerations(user.id, 5),
    getUserApiKeys(user.id),
    getDailyUsage(user.id, 30),
  ]);

  const limit = getPlanLimit(user.plan);
  const firstKey = keys[0];

  const generations = recentGens.map((g) => ({
    id: g.id,
    template: g.templateId ? 'Template' : 'HTML',
    pages: g.pages || 0,
    time: g.generationTimeMs ? `${(g.generationTimeMs / 1000).toFixed(1)}s` : '—',
    status: (g.status === 'completed' ? 'completed' : 'failed') as 'completed' | 'failed',
    ago: timeAgo(g.createdAt),
  }));

  const planLabel = user.plan.charAt(0).toUpperCase() + user.plan.slice(1);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        usageCount={stats.generationCount}
        usageLimit={limit}
      />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            Overview
          </h1>
          <Link
            href="https://docs.docuforge.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold shadow-[0_0_30px_rgba(249,115,22,0.15)]"
          >
            <span>&#9889;</span> Generate PDF
          </Link>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <StatCard
            value={stats.generationCount.toLocaleString()}
            label="PDFs Generated"
          />
          <StatCard
            value={stats.avgTimeMs > 0 ? `${(stats.avgTimeMs / 1000).toFixed(1)}s` : '—'}
            label="Avg Generation Time"
          />
          <StatCard
            value={stats.successRate > 0 ? `${stats.successRate}%` : '—'}
            label="Success Rate"
          />
          <StatCard value={`$${planLabel === 'Free' ? '0' : planLabel}`} label="Current Plan" />
        </div>

        <div className="mb-6">
          <UsageChart data={chartData} />
        </div>

        <div className="mb-6">
          <GenerationTable generations={generations} />
        </div>

        <ApiKeyDisplay
          keyPreview={
            firstKey ? `${firstKey.keyPrefix}${'•'.repeat(16)}` : 'No API key yet'
          }
        />
      </main>
    </div>
  );
}
