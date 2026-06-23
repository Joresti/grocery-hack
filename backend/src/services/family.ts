import {
  getFamilyMemberLink,
  createMealSuggestion,
  getMySuggestionsForPlan,
  getPendingSuggestionForMeal,
} from '../db/queries/family.js';
import { getCurrentPlan, getSavingsThisWeek } from '../db/queries/landing.js';
import { findMealById } from '../db/queries/meals.js';
import {
  throwBadRequest,
  throwConflict,
  throwForbidden,
  throwNotFound,
} from '../middleware/errorHandler.js';

const DUPLICATE_SUGGESTION_MESSAGE = 'You already have a pending suggestion for this meal.';

/** A Postgres unique-violation (e.g. the partial-unique pending-suggestion index). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === '23505'
  );
}

export interface FamilyPlanServiceResponse {
  holder_display_name: string | null;
  holder_savings_this_week: number;
  plan: Record<string, unknown>;
  pending_suggestions: Record<string, unknown>[];
}

/**
 * Does the plan JSONB contain a meal with this mealId in any stop of either
 * the one- or two-store representation? Plan JSONB stores camelCase keys
 * (stops[].meals[].mealId), matching the GroceryPlan shared type.
 */
function planContainsMeal(plan: Record<string, unknown>, mealId: string): boolean {
  const representations = [plan.one_store_optimized, plan.two_store_optimized];
  for (const rep of representations) {
    if (rep === null || typeof rep !== 'object') continue;
    const stops = (rep as { stops?: unknown }).stops;
    if (!Array.isArray(stops)) continue;
    for (const stop of stops) {
      const meals = (stop as { meals?: unknown }).meals;
      if (!Array.isArray(meals)) continue;
      for (const meal of meals) {
        if ((meal as { mealId?: unknown }).mealId === mealId) return true;
      }
    }
  }
  return false;
}

export async function getFamilyPlan(userId: string): Promise<FamilyPlanServiceResponse> {
  const link = await getFamilyMemberLink(userId);

  if (!link?.accountHolderId) {
    throwForbidden('NOT_A_FAMILY_MEMBER', "You're not linked to an account holder.");
  }

  const holderId = link.accountHolderId;

  const [plan, savingsThisWeek] = await Promise.all([
    getCurrentPlan(holderId),
    getSavingsThisWeek(holderId),
  ]);

  if (!plan) {
    throwNotFound('NO_PLAN', "The account holder doesn't have a plan for this week yet.");
  }

  const pendingSuggestions = await getMySuggestionsForPlan(userId, plan.id as string);

  return {
    holder_display_name: link.holderDisplayName,
    holder_savings_this_week: savingsThisWeek,
    plan,
    pending_suggestions: pendingSuggestions,
  };
}

/**
 * A family member suggests replacing a meal in the account holder's current-week
 * plan with another meal from the shared pool. Stored as `pending`; the plan itself
 * is not mutated (the holder reviews / accepts / dismisses in later slices).
 */
export async function suggestMeal(
  userId: string,
  targetMealId: string,
  replacementMealId: string,
): Promise<Record<string, unknown>> {
  // 1. Caller must be a family member linked to an account holder.
  const link = await getFamilyMemberLink(userId);
  if (!link?.accountHolderId) {
    throwForbidden('NOT_A_FAMILY_MEMBER', "You're not linked to an account holder.");
  }
  const holderId = link.accountHolderId;

  // 2. The holder must have a current-week plan.
  const plan = await getCurrentPlan(holderId);
  if (!plan) {
    throwNotFound('NO_PLAN', "The account holder doesn't have a plan for this week yet.");
  }

  // 3. The target meal must actually be in that plan.
  if (!planContainsMeal(plan, targetMealId)) {
    throwBadRequest('MEAL_NOT_IN_PLAN', "That meal isn't in the current plan.");
  }

  // 4. The replacement meal must exist in the shared pool.
  const replacement = await findMealById(replacementMealId);
  if (!replacement) {
    throwBadRequest('INVALID_MEAL', "That replacement meal doesn't exist.");
  }

  // 5. At most one *pending* suggestion per meal per family member (the rule the UI
  //    hides the button for, enforced here so a second submission is impossible even
  //    outside the happy-path UI).
  const existing = await getPendingSuggestionForMeal(userId, plan.id as string, targetMealId);
  if (existing) {
    throwConflict('DUPLICATE_SUGGESTION', DUPLICATE_SUGGESTION_MESSAGE);
  }

  // 6. Record the suggestion. A concurrent submit could race past the pre-check, so
  //    map the partial-unique-index violation (pg 23505) to the same 409.
  try {
    return await createMealSuggestion({
      suggesterId: userId,
      accountHolderId: holderId,
      weeklyPlanId: plan.id as string,
      targetMealId,
      replacementMealId,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throwConflict('DUPLICATE_SUGGESTION', DUPLICATE_SUGGESTION_MESSAGE);
    }
    throw err;
  }
}
