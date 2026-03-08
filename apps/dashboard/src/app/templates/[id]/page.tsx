import { redirect, notFound } from 'next/navigation';
import { getCurrentUser, getTemplate, getOverviewStats, getPlanLimit } from '@/lib/data';
import { TemplateEditor } from './editor';

export default async function TemplateEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [template, stats] = await Promise.all([
    getTemplate(user.id, params.id),
    getOverviewStats(user.id),
  ]);

  if (!template) notFound();

  return (
    <TemplateEditor
      template={{
        id: template.id,
        name: template.name,
        htmlContent: template.htmlContent,
        version: template.version,
      }}
      usageCount={stats.generationCount}
      usageLimit={getPlanLimit(user.plan)}
    />
  );
}
