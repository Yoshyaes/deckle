import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getCurrentUser, getPlanLimit } from '@/lib/data';
import { ModerationClient } from './moderation-client';

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'admin') redirect('/');

  const limit = getPlanLimit(user.plan);

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={0} usageLimit={limit} isAdmin />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-1">
          Marketplace moderation
        </h1>
        <p className="text-sm text-text-dim mb-6">
          Open and auto-actioned reports on public templates. Reports auto-hide the
          template at 3 independent flags.
        </p>
        <ModerationClient />
      </main>
    </div>
  );
}
