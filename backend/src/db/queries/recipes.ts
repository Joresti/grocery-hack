import { pool } from '../client.js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  perServing: boolean;
}

export interface RecipeCreateData {
  name: string;
  ingredients: Ingredient[];
  tagline?: string;
  description?: string;
  instructions?: string;
  steps?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  difficulty?: string;
  dietaryTags?: string[];
  tips?: string;
  nutrition?: Nutrition;
  isPublic?: boolean;
}

export interface RecipeStats {
  recipe_id: string;
  is_public: boolean;
  weekly_match_count: number;
  total_match_count: number;
}

// ────────────────────────────────────────────────────────────
// Row → Snake-case API mapper
// ────────────────────────────────────────────────────────────

function mapRecipeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    tagline: (row.tagline as string) ?? null,
    description: (row.description as string) ?? null,
    instructions: (row.instructions as string) ?? null,
    images: (row.images as string[]) ?? [],
    ingredients: row.ingredients,
    steps: (row.steps as string[]) ?? [],
    prep_time_minutes: (row.prep_time_minutes as number) ?? null,
    cook_time_minutes: (row.cook_time_minutes as number) ?? null,
    servings: (row.servings as number) ?? 4,
    difficulty: (row.difficulty as string) ?? 'easy',
    dietary_tags: (row.dietary_tags as string[]) ?? [],
    taste_tags: row.taste_tags ?? {},
    tips: (row.tips as string) ?? null,
    ingredient_keywords: (row.ingredient_keywords as string[]) ?? [],
    cost_drivers: (row.cost_drivers as string[]) ?? [],
    nutrition: row.nutrition ?? null,
    is_public: (row.is_public as boolean) ?? false,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
    updated_at: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : (row.updated_at as string),
  };
}

// ────────────────────────────────────────────────────────────
// Helper: extract ingredient keywords
// ────────────────────────────────────────────────────────────

function extractIngredientKeywords(ingredients: Ingredient[]): string[] {
  return ingredients.map(i => i.name.toLowerCase().trim()).filter(k => k.length > 0);
}

// ────────────────────────────────────────────────────────────
// Helper: extract cost drivers (simple heuristic)
// ────────────────────────────────────────────────────────────

function extractCostDrivers(ingredients: Ingredient[]): string[] {
  return ingredients
    .map(i => i.name.toLowerCase().trim())
    .filter(name => name.length > 5);
}

// ────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────

/**
 * Find all recipes belonging to a user, ordered newest first.
 */
export async function findUserRecipes(
  userId: string,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT * FROM user_recipes WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );

  return (rows as Record<string, unknown>[]).map(mapRecipeRow);
}

/**
 * Find a single recipe by ID.
 * Returns null if not found.
 */
export async function findRecipeById(
  recipeId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM user_recipes WHERE id = $1`,
    [recipeId],
  );

  if (rows.length === 0) return null;
  return mapRecipeRow(rows[0] as Record<string, unknown>);
}

/**
 * Insert a new user recipe.
 */
export async function createRecipe(
  userId: string,
  data: RecipeCreateData,
): Promise<Record<string, unknown>> {
  const ingredientKeywords = extractIngredientKeywords(data.ingredients);
  const costDrivers = extractCostDrivers(data.ingredients);

  const { rows } = await pool.query(
    `INSERT INTO user_recipes (
       user_id, name, tagline, description, instructions,
       ingredients, steps, prep_time_minutes, cook_time_minutes,
       servings, difficulty, dietary_tags, tips,
       ingredient_keywords, cost_drivers, nutrition, is_public
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12, $13,
       $14, $15, $16, $17
     ) RETURNING *`,
    [
      userId,
      data.name,
      data.tagline ?? null,
      data.description ?? null,
      data.instructions ?? null,
      JSON.stringify(data.ingredients),
      data.steps ?? null,
      data.prepTimeMinutes ?? null,
      data.cookTimeMinutes ?? null,
      data.servings ?? null,
      data.difficulty ?? 'easy',
      data.dietaryTags ?? [],
      data.tips ?? null,
      ingredientKeywords,
      costDrivers,
      data.nutrition ? JSON.stringify(data.nutrition) : null,
      data.isPublic ?? false,
    ],
  );

  return mapRecipeRow(rows[0] as Record<string, unknown>);
}

/**
 * Dynamically update a recipe. Only sets fields that are provided.
 */
export async function updateRecipe(
  recipeId: string,
  data: Partial<RecipeCreateData>,
): Promise<Record<string, unknown> | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }

  if (data.tagline !== undefined) {
    setClauses.push(`tagline = $${paramIndex++}`);
    values.push(data.tagline);
  }

  if (data.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }

  if (data.instructions !== undefined) {
    setClauses.push(`instructions = $${paramIndex++}`);
    values.push(data.instructions);
  }

  if (data.ingredients !== undefined) {
    setClauses.push(`ingredients = $${paramIndex++}`);
    values.push(JSON.stringify(data.ingredients));

    const ingredientKeywords = extractIngredientKeywords(data.ingredients);
    setClauses.push(`ingredient_keywords = $${paramIndex++}`);
    values.push(ingredientKeywords);

    const costDrivers = extractCostDrivers(data.ingredients);
    setClauses.push(`cost_drivers = $${paramIndex++}`);
    values.push(costDrivers);
  }

  if (data.steps !== undefined) {
    setClauses.push(`steps = $${paramIndex++}`);
    values.push(data.steps);
  }

  if (data.prepTimeMinutes !== undefined) {
    setClauses.push(`prep_time_minutes = $${paramIndex++}`);
    values.push(data.prepTimeMinutes);
  }

  if (data.cookTimeMinutes !== undefined) {
    setClauses.push(`cook_time_minutes = $${paramIndex++}`);
    values.push(data.cookTimeMinutes);
  }

  if (data.servings !== undefined) {
    setClauses.push(`servings = $${paramIndex++}`);
    values.push(data.servings);
  }

  if (data.difficulty !== undefined) {
    setClauses.push(`difficulty = $${paramIndex++}`);
    values.push(data.difficulty);
  }

  if (data.dietaryTags !== undefined) {
    setClauses.push(`dietary_tags = $${paramIndex++}`);
    values.push(data.dietaryTags);
  }

  if (data.tips !== undefined) {
    setClauses.push(`tips = $${paramIndex++}`);
    values.push(data.tips);
  }

  if (data.nutrition !== undefined) {
    setClauses.push(`nutrition = $${paramIndex++}`);
    values.push(JSON.stringify(data.nutrition));
  }

  if (data.isPublic !== undefined) {
    setClauses.push(`is_public = $${paramIndex++}`);
    values.push(data.isPublic);
  }

  if (setClauses.length === 0) {
    return findRecipeById(recipeId);
  }

  values.push(recipeId);
  const whereParam = paramIndex;

  const { rows } = await pool.query(
    `UPDATE user_recipes SET ${setClauses.join(', ')} WHERE id = $${whereParam} RETURNING *`,
    values,
  );

  if (rows.length === 0) return null;
  return mapRecipeRow(rows[0] as Record<string, unknown>);
}

/**
 * Delete a recipe by ID.
 * Returns true if deleted, false if not found.
 */
export async function deleteRecipe(
  recipeId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM user_recipes WHERE id = $1`,
    [recipeId],
  );

  return (rowCount ?? 0) > 0;
}

/**
 * Get recipe performance stats.
 * For now, returns placeholder counts (real stats come from the planner).
 */
export async function getRecipeStats(
  recipeId: string,
): Promise<RecipeStats | null> {
  const { rows } = await pool.query(
    `SELECT id, is_public FROM user_recipes WHERE id = $1`,
    [recipeId],
  );

  if (rows.length === 0) return null;

  const row = rows[0] as Record<string, unknown>;
  return {
    recipe_id: row.id as string,
    is_public: row.is_public as boolean,
    weekly_match_count: 0,
    total_match_count: 0,
  };
}

/**
 * Update recipe visibility (public/private toggle).
 */
export async function updateRecipeVisibility(
  recipeId: string,
  isPublic: boolean,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `UPDATE user_recipes SET is_public = $2 WHERE id = $1 RETURNING *`,
    [recipeId, isPublic],
  );

  if (rows.length === 0) return null;
  return mapRecipeRow(rows[0] as Record<string, unknown>);
}
