import { pool } from './client.js';
import { optimize } from '../services/optimizer.js';

const TEST_USER_EMAILS = [
  'jessica@test.groceryhack.com',
  'marcus@test.groceryhack.com',
  'priya@test.groceryhack.com',
  'david@test.groceryhack.com',
  'sarah@test.groceryhack.com',
];

async function seedPlans(): Promise<void> {
  const { rows } = await pool.query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
    [TEST_USER_EMAILS],
  );

  if (rows.length === 0) {
    console.error('No test users found. Run `npm run seed` first.');
    process.exit(1);
  }

  console.log(`Generating weekly plans for ${rows.length} users...`);

  for (const user of rows) {
    try {
      const plan = await optimize(user.id, {});
      console.log(`  ${user.email} → plan ${plan.id as string} (token=${plan.token as string})`);
    } catch (err) {
      console.error(`  ${user.email} → FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  await pool.end();
  console.log('Done.');
}

seedPlans().catch((err: unknown) => {
  console.error('Fatal seedPlans error:', err);
  process.exit(1);
});
