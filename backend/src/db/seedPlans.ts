import { pool } from './client.js';
import { optimize } from '../services/optimizer.js';
import type { GroceryPlan } from '@groceryhack/shared/types.js';

const TEST_USER_EMAILS = [
  'jessica@test.groceryhack.com',
  'marcus@test.groceryhack.com',
  'priya@test.groceryhack.com',
  'david@test.groceryhack.com',
  'sarah@test.groceryhack.com',
];

const HOLDER_EMAIL = 'jessica@test.groceryhack.com';
const SUGGESTER_EMAIL = 'sam@test.groceryhack.com';

/** Collect every mealId referenced across the one-store plan's stops. */
function planMealIds(plan: GroceryPlan): string[] {
  return plan.stops.flatMap((stop) => stop.meals.map((meal) => meal.mealId));
}

/**
 * Seed one deterministic *pending* Sam → Jessica suggestion so the account holder's
 * review surface has content after `npm run seed && npm run seed:plans`. Idempotent:
 * skips if a pending Sam → Jessica suggestion already exists. Sam is a family member
 * (seeded in seed.ts, not in the plan-generation loop), so we look his id up directly.
 */
async function seedHolderSuggestion(
  holderId: string,
  holderPlan: { id: string; one_store_optimized: GroceryPlan },
): Promise<void> {
  const { rows: samRows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [SUGGESTER_EMAIL],
  );
  const samId = samRows[0]?.id;
  if (!samId) {
    console.warn(`  Suggestion seed skipped: ${SUGGESTER_EMAIL} not found (run \`npm run seed\`).`);
    return;
  }

  // Idempotency: one pending Sam → Jessica suggestion is enough.
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM meal_suggestions
     WHERE suggester_id = $1 AND account_holder_id = $2 AND status = 'pending'
     LIMIT 1`,
    [samId, holderId],
  );
  if (existing.length > 0) {
    console.log('  Pending Sam → Jessica suggestion already exists — skipping.');
    return;
  }

  // Target = first meal actually in Jessica's plan; replacement = any other meal.
  const mealIds = planMealIds(holderPlan.one_store_optimized);
  const targetMealId = mealIds[0];
  if (!targetMealId) {
    console.warn("  Suggestion seed skipped: Jessica's plan has no meals.");
    return;
  }

  const { rows: replRows } = await pool.query<{ id: string }>(
    `SELECT id FROM meals WHERE id <> ALL($1::uuid[]) ORDER BY name LIMIT 1`,
    [mealIds],
  );
  const replacementMealId = replRows[0]?.id;
  if (!replacementMealId) {
    console.warn('  Suggestion seed skipped: no replacement meal available.');
    return;
  }

  await pool.query(
    `INSERT INTO meal_suggestions
       (suggester_id, account_holder_id, weekly_plan_id, target_meal_id, replacement_meal_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [samId, holderId, holderPlan.id, targetMealId, replacementMealId],
  );
  console.log('  Seeded one pending Sam → Jessica suggestion.');
}

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

  let holderId: string | null = null;
  let holderPlan: { id: string; one_store_optimized: GroceryPlan } | null = null;

  for (const user of rows) {
    try {
      const plan = await optimize(user.id, {});
      console.log(`  ${user.email} → plan ${plan.id as string} (token=${plan.token as string})`);
      if (user.email === HOLDER_EMAIL) {
        holderId = user.id;
        holderPlan = {
          id: plan.id as string,
          one_store_optimized: plan.one_store_optimized as GroceryPlan,
        };
      }
    } catch (err) {
      console.error(`  ${user.email} → FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  if (holderId && holderPlan) {
    await seedHolderSuggestion(holderId, holderPlan);
  } else {
    console.warn(`  Suggestion seed skipped: no plan generated for ${HOLDER_EMAIL}.`);
  }

  await pool.end();
  console.log('Done.');
}

seedPlans().catch((err: unknown) => {
  console.error('Fatal seedPlans error:', err);
  process.exit(1);
});
