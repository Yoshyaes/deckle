import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/data';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }
  const userId = user.id;

  const body = await request.json().catch(() => ({}));
  const { action, plan } = body;

  if (action === 'checkout') {
    if (!plan || !['starter', 'pro'].includes(plan)) {
      return NextResponse.json(
        { error: { message: 'Invalid plan' } },
        { status: 400 },
      );
    }

    // Get user's API key to authenticate with backend
    const apiKey = await getFirstApiKey(userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'No API key found. Create one first.' } },
        { status: 400 },
      );
    }

    const res = await fetch(`${API_BASE}/v1/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === 'portal') {
    const apiKey = await getFirstApiKey(userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'No API key found.' } },
        { status: 400 },
      );
    }

    const res = await fetch(`${API_BASE}/v1/billing/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(
    { error: { message: 'Invalid action' } },
    { status: 400 },
  );
}

async function getFirstApiKey(userId: string): Promise<string | null> {
  // In dev mode, use the bypass key
  if (process.env.DOCUFORGE_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return 'df_live_dev_bypass';
  }

  // Look up user's first API key from the database
  const { db, apiKeys } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');

  const [key] = await db
    .select({ keyPrefix: apiKeys.keyPrefix })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .limit(1);

  // We can't recover the raw key from the hash, so for billing
  // we make direct DB calls instead of proxying through the API
  return key ? key.keyPrefix : null;
}
