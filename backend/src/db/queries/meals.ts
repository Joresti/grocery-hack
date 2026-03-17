import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Row → Snake-case API mapper
// ────────────────────────────────────────────────────────────

function mapMealRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id as string,
    name: row.name as string,
    tagline: (row.tagline as string) ?? null,
    description: (row.description as string) ?? null,
    instructions: (row.instructions as string) ?? null,
    images: (row.images as string[]) ?? [],
    ingredients: row.ingredients ?? [],
    steps: (row.steps as string[]) ?? [],
    prep_time_minutes: (row.prep_time_minutes as number) ?? null,
    cook_time_minutes: (row.cook_time_minutes as number) ?? null,
    servings: (row.servings as number) ?? 4,
    difficulty: (row.difficulty as string) ?? 'easy',
    filter_tags: (row.filter_tags as string[]) ?? [],
    taste_tags: row.taste_tags ?? {},
    tips: (row.tips as string) ?? null,
    nutrition: row.nutrition ?? null,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
  };
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find meals the user has NOT yet swiped on.
 * Ordered by approval_score DESC (best first), then newest.
 * Includes attribution fields and weekly deal match count.
 */
export async function findSwipeableMeals(
  userId: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       m.*,
       NULL::text AS shared_by_name,
       NULL::text AS shared_by_initials,
       (
         SELECT COUNT(*)::integer FROM deals d
         WHERE d.valid_from <= CURRENT_DATE
           AND d.valid_to >= CURRENT_DATE
           AND EXISTS (
             SELECT 1 FROM unnest(m.ingredient_keywords) kw
             WHERE d.item_name ILIKE '%' || kw || '%'
           )
       ) AS weekly_match_count
     FROM meals m
     WHERE m.id NOT IN (
       SELECT meal_id FROM user_meal_preferences WHERE user_id = $1
     )
     ORDER BY m.approval_score DESC NULLS LAST, m.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    ...mapMealRow(row),
    shared_by_name: null,
    shared_by_initials: null,
    weekly_match_count: Number(row.weekly_match_count) || 0,
  }));
}

/**
 * Find a single meal by ID.
 * Returns null if not found.
 */
export async function findMealById(
  mealId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM meals WHERE id = $1`,
    [mealId],
  );

  if (rows.length === 0) return null;
  return mapMealRow(rows[0] as Record<string, unknown>);
}

/**
 * Record a swipe (like or skip).
 * Inserts into user_meal_preferences and updates aggregate counts on meals.
 * Throws an error with code 23505 on unique constraint violation (already swiped).
 */
export async function recordSwipe(
  userId: string,
  mealId: string,
  liked: boolean,
): Promise<Record<string, unknown>> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert preference
    const { rows: prefRows } = await client.query(
      `INSERT INTO user_meal_preferences (user_id, meal_id, liked)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, mealId, liked],
    );

    // Update swipe counts
    if (liked) {
      await client.query(
        `UPDATE meals SET swipe_right_count = swipe_right_count + 1 WHERE id = $1`,
        [mealId],
      );
    } else {
      await client.query(
        `UPDATE meals SET swipe_left_count = swipe_left_count + 1 WHERE id = $1`,
        [mealId],
      );
    }

    // Recalculate approval_score (only meaningful after 5+ total swipes)
    await client.query(
      `UPDATE meals
       SET approval_score = CASE
         WHEN (swipe_right_count + swipe_left_count) >= 5
           THEN swipe_right_count::numeric / (swipe_right_count + swipe_left_count)
         ELSE NULL
       END
       WHERE id = $1`,
      [mealId],
    );

    await client.query('COMMIT');

    const pref = prefRows[0] as Record<string, unknown>;
    return {
      id: pref.id as string,
      user_id: pref.user_id as string,
      meal_id: pref.meal_id as string,
      liked: pref.liked as boolean,
      swiped_at: pref.swiped_at instanceof Date
        ? pref.swiped_at.toISOString()
        : (pref.swiped_at as string),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Find all meals the user has liked, enriched with deal context.
 * Includes count and list of ingredients currently on sale.
 */
export async function findLikedMeals(
  userId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       m.*,
       ump.swiped_at AS liked_at,
       (
         SELECT COUNT(*)::integer FROM deals d
         WHERE d.valid_from <= CURRENT_DATE
           AND d.valid_to >= CURRENT_DATE
           AND EXISTS (
             SELECT 1 FROM unnest(m.ingredient_keywords) kw
             WHERE d.item_name ILIKE '%' || kw || '%'
           )
       ) AS ingredients_on_sale_count,
       ARRAY(
         SELECT d.item_name FROM deals d
         WHERE d.valid_from <= CURRENT_DATE
           AND d.valid_to >= CURRENT_DATE
           AND EXISTS (
             SELECT 1 FROM unnest(m.ingredient_keywords) kw
             WHERE d.item_name ILIKE '%' || kw || '%'
           )
       ) AS ingredients_on_sale
     FROM meals m
     JOIN user_meal_preferences ump ON ump.meal_id = m.id
     WHERE ump.user_id = $1 AND ump.liked = true
     ORDER BY ump.swiped_at DESC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    meal: mapMealRow(row),
    liked_at: row.liked_at instanceof Date
      ? row.liked_at.toISOString()
      : (row.liked_at as string),
    ingredients_on_sale_count: Number(row.ingredients_on_sale_count) || 0,
    ingredients_on_sale: (row.ingredients_on_sale as string[]) ?? [],
    estimated_cost: null,
  }));
}
