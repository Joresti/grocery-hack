import { pool } from '../client.js';
import type { PriceTier, GroceryPlan, WatchlistAlert as WatchlistAlertType, RecipeAlert as RecipeAlertType } from '@groceryhack/shared/types.js';

// ────────────────────────────────────────────────────────────
// Landing Page Queries
// ────────────────────────────────────────────────────────────

/**
 * Get estimated savings for the current week from the user's latest weekly plan.
 * Returns 0 if no plan exists for the current week.
 */
export async function getSavingsThisWeek(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(
       (one_store_optimized->>'estimatedSavings')::numeric, 0
     ) AS savings
     FROM weekly_plans
     WHERE user_id = $1 AND week_of >= date_trunc('week', CURRENT_DATE)
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );

  if (rows.length === 0) return 0;
  return Number((rows[0] as Record<string, unknown>).savings);
}

/**
 * Sum estimated savings across all weekly plans for this user this calendar year.
 */
export async function getSavingsYtd(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(
       SUM((one_store_optimized->>'estimatedSavings')::numeric), 0
     ) AS savings
     FROM weekly_plans
     WHERE user_id = $1 AND week_of >= date_trunc('year', CURRENT_DATE)`,
    [userId],
  );

  return Number((rows[0] as Record<string, unknown>).savings);
}

/**
 * Find deals matching items in the user's watchlist.
 * JOINs deal_watchlist with deals on item_keyword ILIKE matching.
 * Returns snake_case objects ordered by relative discount (best deals first).
 */
export async function getWatchlistAlerts(userId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       dw.item_keyword AS item,
       sb.name AS store,
       sl.address AS store_address,
       d.sale_price,
       d.regular_price,
       dw.benchmark_price,
       dw.price_tier
     FROM deal_watchlist dw
     JOIN deals d ON d.item_name ILIKE '%' || dw.item_keyword || '%'
       AND d.valid_from <= CURRENT_DATE AND d.valid_to >= CURRENT_DATE
     JOIN store_brands sb ON sb.id = d.store_brand_id
     LEFT JOIN store_locations sl ON sl.id = d.store_location_id
     WHERE dw.user_id = $1
     ORDER BY d.sale_price / NULLIF(dw.benchmark_price, 0) ASC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    item: row.item as string,
    store: row.store as string,
    store_address: (row.store_address as string) ?? undefined,
    sale_price: Number(row.sale_price),
    regular_price: Number(row.regular_price),
    benchmark_price: Number(row.benchmark_price),
    price_tier: row.price_tier as PriceTier,
  }));
}

/**
 * Find user recipes that have ingredients currently on sale.
 * Returns snake_case objects for the RecipeAlert shape.
 */
export async function getRecipeAlerts(userId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT
       ur.id AS recipe_id,
       ur.name AS recipe_name,
       (SELECT COUNT(DISTINCT d.id) FROM deals d
        WHERE d.valid_from <= CURRENT_DATE AND d.valid_to >= CURRENT_DATE
        AND EXISTS (SELECT 1 FROM unnest(ur.ingredient_keywords) kw WHERE d.item_name ILIKE '%' || kw || '%')
       ) AS ingredients_on_sale,
       0 AS estimated_cost,
       0 AS regular_cost,
       0 AS savings
     FROM user_recipes ur
     WHERE ur.user_id = $1 AND ur.ingredient_keywords != '{}'
     AND (SELECT COUNT(DISTINCT d.id) FROM deals d
       WHERE d.valid_from <= CURRENT_DATE AND d.valid_to >= CURRENT_DATE
       AND EXISTS (SELECT 1 FROM unnest(ur.ingredient_keywords) kw WHERE d.item_name ILIKE '%' || kw || '%')
     ) > 0`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    recipe_id: row.recipe_id as string,
    recipe_name: row.recipe_name as string,
    ingredients_on_sale: Number(row.ingredients_on_sale),
    estimated_cost: Number(row.estimated_cost),
    regular_cost: Number(row.regular_cost),
    savings: Number(row.savings),
  }));
}

/**
 * Get the user's current weekly plan (for the current week or later).
 * Returns snake_case object or null if no plan exists.
 */
export async function getCurrentPlan(userId: string): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM weekly_plans
     WHERE user_id = $1 AND week_of >= date_trunc('week', CURRENT_DATE)
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );

  if (rows.length === 0) return null;

  const row = rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    token: row.token as string,
    week_of: row.week_of instanceof Date
      ? row.week_of.toISOString().split('T')[0]!
      : (row.week_of as string),
    one_store_optimized: row.one_store_optimized as GroceryPlan,
    two_store_optimized: (row.two_store_optimized as GroceryPlan | null) ?? null,
    watchlist_alerts: (row.watchlist_alerts as WatchlistAlertType[]) ?? [],
    recipe_alerts: (row.recipe_alerts as RecipeAlertType[]) ?? [],
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
  };
}

/**
 * Get the user's active important items.
 * Returns snake_case objects ordered by creation date.
 */
export async function getImportantItems(userId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT * FROM important_items
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at ASC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    quantity: (row.quantity as string | null) ?? null,
    is_active: row.is_active as boolean,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
    deactivated_at: row.deactivated_at instanceof Date
      ? row.deactivated_at.toISOString()
      : ((row.deactivated_at as string | null) ?? null),
  }));
}
