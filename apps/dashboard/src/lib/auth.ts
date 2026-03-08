import { auth } from '@clerk/nextjs/server';

export async function getUserId(): Promise<string> {
  if (process.env.DOCUFORGE_DEV_BYPASS === 'true') {
    return 'dev-user-id';
  }
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
