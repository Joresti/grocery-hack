import * as userQueries from '../db/queries/users.js';
import * as mealQueries from '../db/queries/meals.js';
import * as dealQueries from '../db/queries/deals.js';
import * as landingQueries from '../db/queries/landing.js';
import { countHolderPendingSuggestions } from '../db/queries/family.js';
import { userToSnakeCase } from './auth.js';
const MAX_SWIPEABLE_MEALS = 20;
const MAX_LIKED_MEALS_PREVIEW = 6;
const MAX_NOTABLE_DEALS = 10;
import { throwNotFound } from '../middleware/errorHandler.js';

// ────────────────────────────────────────────────────────────
// Landing Page Service
// ────────────────────────────────────────────────────────────

export interface LandingPageResponse {
  user: Record<string, unknown>;
  savings_this_week: number;
  savings_ytd: number;
  watchlist_alerts: Record<string, unknown>[];
  recipe_alerts: Record<string, unknown>[];
  swipeable_meals: Record<string, unknown>[];
  liked_meals_preview: Record<string, unknown>[];
  current_plan: Record<string, unknown> | null;
  notable_deals: Record<string, unknown>[];
  important_items: Record<string, unknown>[];
  pending_suggestion_count: number;
}

/**
 * Assemble the full landing page payload in a single call.
 * All queries run in parallel for optimal performance.
 */
export async function getLandingPage(userId: string): Promise<LandingPageResponse> {
  const [
    user,
    savingsThisWeek,
    savingsYtd,
    watchlistAlerts,
    recipeAlerts,
    swipeableMeals,
    likedMeals,
    currentPlan,
    notableDeals,
    importantItems,
    pendingSuggestionCount,
  ] = await Promise.all([
    userQueries.findUserById(userId),
    landingQueries.getSavingsThisWeek(userId),
    landingQueries.getSavingsYtd(userId),
    landingQueries.getWatchlistAlerts(userId),
    landingQueries.getRecipeAlerts(userId),
    mealQueries.findSwipeableMeals(userId, MAX_SWIPEABLE_MEALS),
    mealQueries.findLikedMeals(userId),
    landingQueries.getCurrentPlan(userId),
    dealQueries.findNotableDeals(MAX_NOTABLE_DEALS),
    landingQueries.getImportantItems(userId),
    countHolderPendingSuggestions(userId),
  ]);

  if (!user) {
    throwNotFound('USER_NOT_FOUND', 'User not found.');
  }

  return {
    user: userToSnakeCase(user),
    savings_this_week: savingsThisWeek,
    savings_ytd: savingsYtd,
    watchlist_alerts: watchlistAlerts,
    recipe_alerts: recipeAlerts,
    swipeable_meals: swipeableMeals,
    liked_meals_preview: likedMeals.slice(0, MAX_LIKED_MEALS_PREVIEW),
    current_plan: currentPlan,
    notable_deals: notableDeals,
    important_items: importantItems,
    pending_suggestion_count: pendingSuggestionCount,
  };
}
