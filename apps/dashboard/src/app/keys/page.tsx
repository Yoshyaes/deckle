import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getCurrentUser, getUserApiKeys, getOverviewStats, getPlanLimit } from '@/lib/data';
import { KeysClient } from './keys-client';

export default async function KeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [keys, stats] = await Promise.all([
    getUserApiKeys(user.id),
    getOverviewStats(user.id),
  ]);

  const serializedKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: `${k.keyPrefix}...`,
    createdAt: k.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    lastUsed: k.lastUsedAt
      ? k.lastUsedAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={stats.generationCount} usageLimit={getPlanLimit(user.plan)} />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-6">
          API Keys
        </h1>

        <KeysClient initialKeys={serializedKeys} />

        <div className="mt-6 bg-surface border border-border rounded-[14px] p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            API Key Security
          </h3>
          <ul className="text-xs text-text-muted space-y-1">
            <li>&#8226; API keys are hashed and never stored in plaintext</li>
            <li>&#8226; Keys are only shown once at creation time</li>
            <li>&#8226; Rotate keys regularly and revoke unused ones</li>
            <li>&#8226; Never expose API keys in client-side code</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
