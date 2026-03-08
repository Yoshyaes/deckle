/**
 * Seed script for local development.
 * Creates a test user and API key so you can start using the API immediately.
 *
 * Usage: cd apps/api && npx tsx src/scripts/seed.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { users, apiKeys } from '../schema/db.js';

const TEST_API_KEY = 'df_live_test_key_for_local_dev_only_do_not_use_in_prod';

async function seed() {
  console.log('Seeding database...');

  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      email: 'dev@docuforge.local',
      plan: 'pro',
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log('Test user already exists, skipping.');
    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, 'dev@docuforge.local'),
    });
    if (existing) {
      console.log(`User ID: ${existing.id}`);
    }
    process.exit(0);
  }

  console.log(`Created user: ${user.id} (${user.email})`);

  // Create API key
  const keyHash = await bcrypt.hash(TEST_API_KEY, 10);
  const prefix = TEST_API_KEY.slice(0, 16);

  await db.insert(apiKeys).values({
    userId: user.id,
    keyHash,
    keyPrefix: prefix,
    name: 'Development Key',
  });

  console.log('\nDevelopment setup complete!');
  console.log('─'.repeat(50));
  console.log(`API Key: ${TEST_API_KEY}`);
  console.log('─'.repeat(50));
  console.log('\nTest with:');
  console.log(`curl -X POST http://localhost:3000/v1/generate \\`);
  console.log(`  -H "Authorization: Bearer ${TEST_API_KEY}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"html": "<h1>Hello DocuForge</h1>"}'`);

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
