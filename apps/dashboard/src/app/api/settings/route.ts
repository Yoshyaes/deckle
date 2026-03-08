import { NextResponse } from 'next/server';
import { getCurrentUser, getOverviewStats, getPlanLimit } from '@/lib/data';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const stats = await getOverviewStats(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
    },
    stats: {
      generationCount: stats.generationCount,
      limit: getPlanLimit(user.plan),
    },
  });
}
