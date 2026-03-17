import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PlannerUser {
  id: string;
  email: string;
  displayName: string | null;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  budget: number | null;
  dietaryRestrictions: string[];
  maxStores: 1 | 2;
  householdSize: number;
  subscriptionActive: boolean;
}

export interface MealWithKeywords {
  id: string;
  name: string;
  ingredientKeywords: string[];
  ingredients: { name: string; quantity: string; unit: string }[];
  servings: number;
  approvalScore: number | null;
  filterTags: string[];
  tasteTags: Record<string, string>;
  swipeRightCount: number;
  swipeLeftCount: number;
}

export interface SimilarUser {
  userId: string;
  sharedLikes: number;
}

export interface LikedMealInfo {
  mealId: string;
  userId: string;
}

export interface UserRecipeWithCostDrivers {
  id: string;
  name: string;
  ingredientKeywords: string[];
  costDrivers: string[];
}

export interface WatchlistEntry {
  id: string;
  itemKeyword: string;
  productName: string;
  benchmarkPrice: number;
  benchmarkUnit: string;
  priceTier: string;
  storeBrandId: string | null;
}

export interface DealRow {
  id: string;
  storeBrandId: string;
  storeBrandName: string;
  itemName: string;
  salePrice: number;
  regularPrice: number | null;
  unit: string;
  category: string | null;
}

export interface LocationRow {
  id: string;
  storeBrandId: string;
  brandName: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find all active users (subscription_active = true).
 * For trial phase, return all users.
 */
export async function findActiveUsers(): Promise<PlannerUser[]> {
  const { rows } = await pool.query(
    `SELECT id, email, display_name, postal_code, lat, lng, budget,
            dietary_restrictions, max_stores, household_size, subscription_active
     FROM users
     ORDER BY created_at ASC`,
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    email: row.email as string,
    displayName: (row.display_name as string | null) ?? null,
    postalCode: row.postal_code as string,
    lat: row.lat as number | null,
    lng: row.lng as number | null,
    budget: row.budget ? Number(row.budget) : null,
    dietaryRestrictions: (row.dietary_restrictions as string[]) ?? [],
    maxStores: (row.max_stores as 1 | 2) ?? 1,
    householdSize: (row.household_size as number) ?? 1,
    subscriptionActive: (row.subscription_active as boolean) ?? false,
  }));
}

/**
 * Find all meals with ingredient keywords, approval scores, and tags.
 */
export async function findAllMealsWithKeywords(): Promise<MealWithKeywords[]> {
  const { rows } = await pool.query(
    `SELECT id, name, ingredient_keywords, ingredients, servings,
            approval_score, filter_tags, taste_tags,
            swipe_right_count, swipe_left_count
     FROM meals
     ORDER BY created_at DESC`,
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    name: row.name as string,
    ingredientKeywords: (row.ingredient_keywords as string[]) ?? [],
    ingredients: (row.ingredients as { name: string; quantity: string; unit: string }[]) ?? [],
    servings: (row.servings as number) ?? 4,
    approvalScore: row.approval_score !== null && row.approval_score !== undefined
      ? Number(row.approval_score)
      : null,
    filterTags: (row.filter_tags as string[]) ?? [],
    tasteTags: (row.taste_tags as Record<string, string>) ?? {},
    swipeRightCount: (row.swipe_right_count as number) ?? 0,
    swipeLeftCount: (row.swipe_left_count as number) ?? 0,
  }));
}

/**
 * Find users who liked >= minSharedLikes of the same meals as userId.
 * Used for collaborative filtering.
 */
export async function findSimilarUsers(
  userId: string,
  minSharedLikes: number,
): Promise<SimilarUser[]> {
  const { rows } = await pool.query(
    `SELECT ump2.user_id, COUNT(*) as shared_likes
     FROM user_meal_preferences ump1
     JOIN user_meal_preferences ump2
       ON ump1.meal_id = ump2.meal_id AND ump2.liked = true
     WHERE ump1.user_id = $1
       AND ump1.liked = true
       AND ump2.user_id != $1
     GROUP BY ump2.user_id
     HAVING COUNT(*) >= $2
     ORDER BY shared_likes DESC
     LIMIT 10`,
    [userId, minSharedLikes],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    userId: row.user_id as string,
    sharedLikes: Number(row.shared_likes),
  }));
}

/**
 * Find meals liked by a set of users (for collaborative recommendations).
 */
export async function findLikedMealsByUsers(
  userIds: string[],
): Promise<LikedMealInfo[]> {
  if (userIds.length === 0) return [];

  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await pool.query(
    `SELECT meal_id, user_id
     FROM user_meal_preferences
     WHERE user_id IN (${placeholders})
       AND liked = true`,
    userIds,
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    mealId: row.meal_id as string,
    userId: row.user_id as string,
  }));
}

/**
 * Find user recipes with their cost drivers for recipe alert detection.
 */
export async function findUserRecipesWithCostDrivers(
  userId: string,
): Promise<UserRecipeWithCostDrivers[]> {
  const { rows } = await pool.query(
    `SELECT id, name, ingredient_keywords, cost_drivers
     FROM user_recipes
     WHERE user_id = $1`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    name: row.name as string,
    ingredientKeywords: (row.ingredient_keywords as string[]) ?? [],
    costDrivers: (row.cost_drivers as string[]) ?? [],
  }));
}

/**
 * Insert a new meal into the meals table. Returns the new meal ID.
 */
export async function insertMeal(meal: {
  name: string;
  tagline: string | null;
  description: string | null;
  instructions: string | null;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: string[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  servings: number;
  difficulty: string;
  filterTags: string[];
  tasteTags: Record<string, string>;
  tips: string | null;
  ingredientKeywords: string[];
  nutrition: Record<string, unknown> | null;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO meals (
       name, tagline, description, instructions,
       ingredients, steps, prep_time_minutes, cook_time_minutes,
       servings, difficulty, filter_tags, taste_tags,
       tips, ingredient_keywords, nutrition
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      meal.name,
      meal.tagline,
      meal.description,
      meal.instructions,
      JSON.stringify(meal.ingredients),
      meal.steps,
      meal.prepTimeMinutes,
      meal.cookTimeMinutes,
      meal.servings,
      meal.difficulty,
      meal.filterTags,
      JSON.stringify(meal.tasteTags),
      meal.tips,
      meal.ingredientKeywords,
      meal.nutrition ? JSON.stringify(meal.nutrition) : null,
    ],
  );

  return (rows[0] as Record<string, unknown>).id as string;
}

/**
 * Find deals matching ingredient keywords at given store brands.
 * Uses ILIKE for fuzzy matching.
 */
export async function findMatchingDealsForKeywords(
  keywords: string[],
  brandIds: string[],
): Promise<DealRow[]> {
  if (keywords.length === 0 || brandIds.length === 0) return [];

  // Build keyword ILIKE conditions
  const keywordConditions = keywords
    .map((_, i) => `d.item_name ILIKE $${i + 1}`)
    .join(' OR ');

  const brandPlaceholders = brandIds
    .map((_, i) => `$${keywords.length + i + 1}`)
    .join(', ');

  const params = [
    ...keywords.map(k => `%${k}%`),
    ...brandIds,
  ];

  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.store_brand_id,
       sb.name AS store_brand_name,
       d.item_name,
       d.sale_price,
       d.regular_price,
       d.unit,
       d.category
     FROM deals d
     JOIN store_brands sb ON sb.id = d.store_brand_id
     WHERE d.store_brand_id IN (${brandPlaceholders})
       AND d.valid_from <= CURRENT_DATE
       AND d.valid_to >= CURRENT_DATE
       AND (${keywordConditions})
     ORDER BY d.sale_price ASC`,
    params,
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    storeBrandId: row.store_brand_id as string,
    storeBrandName: row.store_brand_name as string,
    itemName: row.item_name as string,
    salePrice: Number(row.sale_price),
    regularPrice: row.regular_price ? Number(row.regular_price) : null,
    unit: row.unit as string,
    category: (row.category as string | null) ?? null,
  }));
}

/**
 * Find a user's watchlist entries.
 */
export async function findUserWatchlist(
  userId: string,
): Promise<WatchlistEntry[]> {
  const { rows } = await pool.query(
    `SELECT id, item_keyword, product_name, benchmark_price, benchmark_unit,
            price_tier, store_brand_id
     FROM deal_watchlist
     WHERE user_id = $1`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    itemKeyword: row.item_keyword as string,
    productName: row.product_name as string,
    benchmarkPrice: Number(row.benchmark_price),
    benchmarkUnit: row.benchmark_unit as string,
    priceTier: row.price_tier as string,
    storeBrandId: (row.store_brand_id as string | null) ?? null,
  }));
}

/**
 * Count the total number of swipes for a user (for cold start detection).
 */
export async function countUserSwipes(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::integer as count
     FROM user_meal_preferences
     WHERE user_id = $1`,
    [userId],
  );

  return Number((rows[0] as Record<string, unknown>).count);
}

/**
 * Find meals the user has already swiped on (to exclude from recommendations).
 */
export async function findSwipedMealIds(userId: string): Promise<Set<string>> {
  const { rows } = await pool.query(
    `SELECT meal_id FROM user_meal_preferences WHERE user_id = $1`,
    [userId],
  );

  return new Set((rows as Record<string, unknown>[]).map(row => row.meal_id as string));
}
