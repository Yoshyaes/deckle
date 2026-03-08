import { NextRequest, NextResponse } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { html, format, orientation } = body;

  if (!html) {
    return NextResponse.json({ error: { message: 'HTML is required' } }, { status: 400 });
  }

  // For dev bypass, use the dev API key
  let authHeader = '';
  if (process.env.DOCUFORGE_DEV_BYPASS === 'true') {
    authHeader = 'Bearer df_live_dev_bypass';
  } else {
    // Get user's first API key
    const [key] = await db
      .select({ keyPrefix: apiKeys.keyPrefix })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .limit(1);

    if (!key) {
      return NextResponse.json(
        { error: { message: 'Create an API key first to use the playground' } },
        { status: 400 },
      );
    }

    // We can't recover the raw key, so make a direct internal call
    authHeader = `Bearer ${key.keyPrefix}`;
  }

  try {
    const res = await fetch(`${API_BASE}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        html,
        options: {
          format: format || 'A4',
          orientation: orientation || 'portrait',
        },
        output: 'url',
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: { message: 'Failed to connect to API' } },
      { status: 502 },
    );
  }
}
