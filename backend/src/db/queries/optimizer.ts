import { pool } from '../client.js';
import type { GroceryPlan, WatchlistAlert, RecipeAlert } from '@groceryhack/shared/types.js';

// ────────────────────────────────────────────────────────────
// Row → camelCase mappers
// ────────────────────────────────────────────────────────────

interface LikedMealRow {
  id: string;
  name: string;
  ingredientKeywords: string[];
  ingredients: { name: string; quantity: string; unit: string }[];
  servings: number;
}

interface ImportantItemRow {
  id: string;
  name: string;
  quantity: string | null;
}

interface DealRow {
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  storeLocationId: string | null;
  itemName: string;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  category: string | null;
}

interface LocationRow {
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

interface UserProfileRow {
  id: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  budget: number | null;
  maxStores: 1 | 2;
  dietaryRestrictions: string[];
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find all meals the user has liked (full meal rows with ingredient_keywords).
 */
export async function findLikedMealsFull(userId: string): Promise<LikedMealRow[]> {
  const { rows } = await pool.query(
    `SELECT
       m.id,
       m.name,
       m.ingredient_keywords,
       m.ingredients,
       m.servings
     FROM meals m
     JOIN user_meal_preferences ump ON ump.meal_id = m.id
     WHERE ump.user_id = $1 AND ump.liked = true
     ORDER BY ump.swiped_at DESC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    name: row.name as string,
    ingredientKeywords: (row.ingredient_keywords as string[]) ?? [],
    ingredients: (row.ingredients as { name: string; quantity: string; unit: string }[]) ?? [],
    servings: (row.servings as number) ?? 4,
  }));
}

/**
 * Find all active important items for a user.
 */
export async function findActiveImportantItems(userId: string): Promise<ImportantItemRow[]> {
  const { rows } = await pool.query(
    `SELECT id, name, quantity
     FROM important_items
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at ASC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    name: row.name as string,
    quantity: (row.quantity as string | null) ?? null,
  }));
}

/**
 * Find active deals at specific store locations (or brand-wide where store_location_id IS NULL).
 * Accepts an array of store brand IDs (not location IDs) to fetch all deals for those brands.
 */
export async function findActiveDealsByBrands(brandIds: string[]): Promise<DealRow[]> {
  if (brandIds.length === 0) return [];

  // Build placeholder list $1, $2, ... for the brand IDs
  const placeholders = brandIds.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       d.store_location_id,
       d.item_name,
       d.sale_price,
       d.regular_price,
       d.unit,
       d.category
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE d.store_brand_id IN (${placeholders})
       AND d.valid_from <= CURRENT_DATE
       AND d.valid_to >= CURRENT_DATE
     ORDER BY d.sale_price ASC`,
    brandIds,
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    storeBrandId: row.store_brand_id as string,
    storeBrandName: row.store_brand_name as string,
    storeLocationId: (row.store_location_id as string | null) ?? null,
    itemName: row.item_name as string,
    salePrice: Number(row.sale_price),
    regularPrice: row.regular_price ? Number(row.regular_price) : null,
    unit: row.unit as string,
    category: (row.category as string | null) ?? null,
  }));
}

/**
 * Find store locations within a radius (km) of a given lat/lng.
 * Uses the PostgreSQL haversine() function.
 */
export async function findNearbyLocations(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<LocationRow[]> {
  const { rows } = await pool.query(
    `SELECT
       sl.id,
       sl.store_brand_id,
       sb.name AS brand_name,
       sl.address,
       sl.lat,
       sl.lng,
       haversine($1, $2, sl.lat, sl.lng) AS distance_km
     FROM store_locations sl
     JOIN store_brands sb ON sb.id = sl.store_brand_id
     WHERE haversine($1, $2, sl.lat, sl.lng) <= $3
     ORDER BY distance_km`,
    [lat, lng, radiusKm],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    storeBrandId: row.store_brand_id as string,
    brandName: row.brand_name as string,
    address: row.address as string,
    lat: Number(row.lat),
    lng: Number(row.lng),
    distanceKm: Number(Number(row.distance_km).toFixed(1)),
  }));
}

/**
 * Save a weekly plan. Returns the saved plan row in snake_case for API response.
 */
export async function saveWeeklyPlan(
  userId: string,
  token: string,
  weekOf: string,
  oneStoreOptimized: GroceryPlan,
  twoStoreOptimized: GroceryPlan | null,
  watchlistAlerts: WatchlistAlert[],
  recipeAlerts: RecipeAlert[],
): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `INSERT INTO weekly_plans (
       user_id, token, week_of,
       one_store_optimized, two_store_optimized,
       watchlist_alerts, recipe_alerts
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, week_of) DO UPDATE SET
       one_store_optimized = EXCLUDED.one_store_optimized,
       two_store_optimized = EXCLUDED.two_store_optimized,
       watchlist_alerts    = EXCLUDED.watchlist_alerts,
       recipe_alerts       = EXCLUDED.recipe_alerts,
       created_at          = now()
     RETURNING *`,
    [
      userId,
      token,
      weekOf,
      JSON.stringify(oneStoreOptimized),
      twoStoreOptimized ? JSON.stringify(twoStoreOptimized) : null,
      JSON.stringify(watchlistAlerts),
      JSON.stringify(recipeAlerts),
    ],
  );

  const row = rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    token: row.token as string,
    week_of: row.week_of instanceof Date
      ? row.week_of.toISOString().split('T')[0]!
      : (row.week_of as string),
    one_store_optimized: row.one_store_optimized as GroceryPlan,
    two_store_optimized: (row.two_store_optimized as GroceryPlan | null) ?? null,
    watchlist_alerts: (row.watchlist_alerts as WatchlistAlert[]) ?? [],
    recipe_alerts: (row.recipe_alerts as RecipeAlert[]) ?? [],
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
  };
}

/**
 * Find a user's profile data needed by the optimizer.
 * Returns null if not found.
 */
export async function findUserById(userId: string): Promise<UserProfileRow | null> {
  const { rows } = await pool.query(
    `SELECT id, postal_code, lat, lng, budget, max_stores, dietary_restrictions
     FROM users WHERE id = $1`,
    [userId],
  );

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: row.id as string,
    postalCode: row.postal_code as string,
    lat: row.lat as number | null,
    lng: row.lng as number | null,
    budget: row.budget ? Number(row.budget) : null,
    maxStores: (row.max_stores as 1 | 2) ?? 1,
    dietaryRestrictions: (row.dietary_restrictions as string[]) ?? [],
  };
}
