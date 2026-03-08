import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getCurrentUser, getOverviewStats, getPlanLimit } from '@/lib/data';
import { StarterGallery } from './gallery-client';

interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  sample_data: Record<string, unknown>;
}

async function getStarterTemplates(): Promise<StarterTemplate[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${apiUrl}/v1/starter-templates`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export default async function TemplateGalleryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [stats, starters] = await Promise.all([
    getOverviewStats(user.id),
    getStarterTemplates(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar usageCount={stats.generationCount} usageLimit={getPlanLimit(user.plan)} />
      <main className="flex-1 p-6 overflow-y-auto">
        <StarterGallery templates={starters} />
      </main>
    </div>
  );
}
