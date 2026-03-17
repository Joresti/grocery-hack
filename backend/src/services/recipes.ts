import * as recipeQueries from '../db/queries/recipes.js';
import type { RecipeCreateData, RecipeStats } from '../db/queries/recipes.js';
import { throwNotFound, throwForbidden } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Get User Recipes
// ────────────────────────────────────────────────────────────

export async function getUserRecipes(
  userId: string,
): Promise<Record<string, unknown>[]> {
  return recipeQueries.findUserRecipes(userId);
}

// ────────────────────────────────────────────────────────────
// Get Single Recipe (with ownership check)
// ────────────────────────────────────────────────────────────

export async function getRecipe(
  userId: string,
  recipeId: string,
): Promise<Record<string, unknown>> {
  const recipe = await recipeQueries.findRecipeById(recipeId);
  if (!recipe || recipe.user_id !== userId) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  return recipe;
}

// ────────────────────────────────────────────────────────────
// Create Recipe
// ────────────────────────────────────────────────────────────

export async function createRecipe(
  userId: string,
  data: RecipeCreateData,
): Promise<Record<string, unknown>> {
  return recipeQueries.createRecipe(userId, data);
}

// ────────────────────────────────────────────────────────────
// Update Recipe
// ────────────────────────────────────────────────────────────

export async function updateRecipe(
  userId: string,
  recipeId: string,
  data: Partial<RecipeCreateData>,
): Promise<Record<string, unknown>> {
  const existing = await recipeQueries.findRecipeById(recipeId);
  if (!existing) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  if (existing.user_id !== userId) {
    throwForbidden('RECIPE_NOT_OWNER', 'You can only access your own recipes.');
  }

  const updated = await recipeQueries.updateRecipe(recipeId, data);
  if (!updated) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  return updated;
}

// ────────────────────────────────────────────────────────────
// Delete Recipe
// ────────────────────────────────────────────────────────────

export async function deleteRecipe(
  userId: string,
  recipeId: string,
): Promise<void> {
  const existing = await recipeQueries.findRecipeById(recipeId);
  if (!existing) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  if (existing.user_id !== userId) {
    throwForbidden('RECIPE_NOT_OWNER', 'You can only access your own recipes.');
  }

  await recipeQueries.deleteRecipe(recipeId);
}

// ────────────────────────────────────────────────────────────
// Get Recipe Stats
// ────────────────────────────────────────────────────────────

export async function getRecipeStats(
  userId: string,
  recipeId: string,
): Promise<RecipeStats> {
  const existing = await recipeQueries.findRecipeById(recipeId);
  if (!existing) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  if (existing.user_id !== userId) {
    throwForbidden('RECIPE_NOT_OWNER', 'You can only access your own recipes.');
  }

  const stats = await recipeQueries.getRecipeStats(recipeId);
  if (!stats) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  return stats;
}

// ────────────────────────────────────────────────────────────
// Publish / Unpublish Recipe
// ────────────────────────────────────────────────────────────

export async function publishRecipe(
  userId: string,
  recipeId: string,
  isPublic: boolean,
): Promise<Record<string, unknown>> {
  const existing = await recipeQueries.findRecipeById(recipeId);
  if (!existing) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  if (existing.user_id !== userId) {
    throwForbidden('RECIPE_NOT_OWNER', 'You can only access your own recipes.');
  }

  const updated = await recipeQueries.updateRecipeVisibility(recipeId, isPublic);
  if (!updated) {
    throwNotFound('RECIPE_NOT_FOUND', 'Recipe not found.');
  }
  return updated;
}
