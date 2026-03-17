import * as mealQueries from '../db/queries/meals.js';
import { throwNotFound, throwConflict } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Get Swipeable Meals
// ────────────────────────────────────────────────────────────

export async function getSwipeableMeals(
  userId: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  return mealQueries.findSwipeableMeals(userId, limit);
}

// ────────────────────────────────────────────────────────────
// Get Meal by ID
// ────────────────────────────────────────────────────────────

export async function getMealById(
  mealId: string,
): Promise<Record<string, unknown>> {
  const meal = await mealQueries.findMealById(mealId);
  if (!meal) {
    throwNotFound('MEAL_NOT_FOUND', 'The requested meal does not exist.');
  }
  return meal;
}

// ────────────────────────────────────────────────────────────
// Swipe Meal
// ────────────────────────────────────────────────────────────

interface SwipeResult {
  preference: Record<string, unknown>;
  taste_profile: Record<string, unknown>;
}

export async function swipeMeal(
  userId: string,
  mealId: string,
  liked: boolean,
): Promise<SwipeResult> {
  // Verify meal exists before attempting swipe
  const meal = await mealQueries.findMealById(mealId);
  if (!meal) {
    throwNotFound('MEAL_NOT_FOUND', 'The requested meal does not exist.');
  }

  try {
    const preference = await mealQueries.recordSwipe(userId, mealId, liked);

    // Taste profile updates are a v1 feature — return empty object for now
    return {
      preference,
      taste_profile: {},
    };
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === '23505') {
      throwConflict('ALREADY_SWIPED', 'You have already swiped on this meal.');
    }
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// Get Liked Meals
// ────────────────────────────────────────────────────────────

export async function getLikedMeals(
  userId: string,
): Promise<Record<string, unknown>[]> {
  return mealQueries.findLikedMeals(userId);
}
