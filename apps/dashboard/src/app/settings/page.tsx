import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getCurrentUser, getOverviewStats, getPlanLimit } from '@/lib/data';
import { BillingActions } from './billing-actions';

const PLAN_DETAILS: Record<string, { label: string; price: string; desc: string }> = {
  free: { label: 'Free', price: '$0', desc: '1,000 PDFs/month · 10MB max file size' },
  starter: { label: 'Starter', price: '$29/mo', desc: '10,000 PDFs/month · 25MB max' },
  pro: { label: 'Pro', price: '$99/mo', desc: '100,000 PDFs/month · 50MB max' },
  enterprise: { label: 'Enterprise', price: 'Custom', desc: 'Unlimited PDFs · SLA' },
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const stats = await getOverviewStats(user.id);
  const plan = PLAN_DETAILS[user.plan] || PLAN_DETAILS.free;

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={stats.generationCount} usageLimit={getPlanLimit(user.plan)} />
      <main className="flex-1 p-6 overflow-y-auto max-w-2xl">
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-6">
          Settings
        </h1>

        <section className="bg-surface border border-border rounded-[14px] p-6 mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Account
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-dim block mb-1">Email</label>
              <div className="text-sm text-text-muted">{user.email}</div>
            </div>
            <div>
              <label className="text-xs text-text-dim block mb-1">User ID</label>
              <div className="text-sm text-text-muted font-mono">{user.id}</div>
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-[14px] p-6 mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Plan & Billing
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary font-medium">
                {plan.label} Plan — {plan.price}
              </div>
              <div className="text-xs text-text-dim mt-1">{plan.desc}</div>
            </div>
            <BillingActions currentPlan={user.plan} />
          </div>
        </section>

        <section className="bg-surface border border-red/20 rounded-[14px] p-6">
          <h2 className="text-sm font-semibold text-red mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary font-medium">
                Delete Account
              </div>
              <div className="text-xs text-text-dim mt-1">
                Permanently delete your account and all data
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg border border-red/30 text-red text-sm font-medium hover:bg-red/10">
              Delete Account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
