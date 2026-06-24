import type { GroceryPlan } from '@groceryhack/shared/types.js';
import {
  getFamilyMemberLink,
  createMealSuggestion,
  getMySuggestionsForPlan,
  getPendingSuggestionForMeal,
  getHolderPendingSuggestions,
  getSuggestionById,
  acceptSuggestionTransaction,
  dismissSuggestion as dismissSuggestionQuery,
} from '../db/queries/family.js';
import { getCurrentPlan, getSavingsThisWeek } from '../db/queries/landing.js';
import { findMealById, findMealForMatching } from '../db/queries/meals.js';
import { findActiveDealsByBrands, findUserById } from '../db/queries/optimizer.js';
import { buildDealsByBrand, getAverageDealPrice } from './optimizer.js';
import { swapMealInPlan, type MatchableMeal } from './mealSwap.js';
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

export interface HolderSuggestionsServiceResponse {
  suggestions: Record<string, unknown>[];
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
 * Every pending suggestion addressed to the authenticated account holder. The caller
 * *is* the holder, so we query by account_holder_id = caller — no family-link lookup.
 * A family member calling this naturally gets [] (their id is never an
 * account_holder_id); the explicit 403 for that case is deferred to Slice 8.
 */
export async function getHolderSuggestions(
  holderId: string,
): Promise<HolderSuggestionsServiceResponse> {
  return { suggestions: await getHolderPendingSuggestions(holderId) };
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

/** Distinct store-brand ids across both plan representations (no store re-pick). */
function collectPlanBrandIds(reps: (GroceryPlan | null)[]): string[] {
  const ids = new Set<string>();
  for (const rep of reps) {
    if (!rep) continue;
    for (const stop of rep.stops) ids.add(stop.storeBrandId);
  }
  return [...ids];
}

/**
 * Load the matchable fields (keywords/servings/name) for every distinct plan meal except
 * the target. The swap needs these because the plan JSONB stores no ingredient keywords
 * and `forMeal` is first-meal-only, so each stop is rebuilt from the real keyword sets.
 */
async function loadRemainingMeals(
  reps: (GroceryPlan | null)[],
  targetMealId: string,
): Promise<Map<string, MatchableMeal>> {
  const ids = new Set<string>();
  for (const rep of reps) {
    if (!rep) continue;
    for (const stop of rep.stops) {
      for (const meal of stop.meals) {
        if (meal.mealId !== targetMealId) ids.add(meal.mealId);
      }
    }
  }

  const meals = new Map<string, MatchableMeal>();
  for (const id of ids) {
    const meal = await findMealForMatching(id);
    if (meal) meals.set(id, meal);
  }
  return meals;
}

/**
 * The account holder accepts a family member's pending suggestion: the target meal is
 * swapped for the replacement in the holder's current-week plan (re-matched against the
 * deals already at the plan's selected store(s) — no store re-pick, no full re-optimize),
 * the shopping list / subtotals / total / savings are recomputed, and the suggestion is
 * marked `accepted` — all in one transaction. Returns the updated suggestion.
 *
 * Guards: 404 SUGGESTION_NOT_FOUND, 403 NOT_SUGGESTION_HOLDER, 409 SUGGESTION_NOT_PENDING,
 * 404 NO_PLAN, 409 PLAN_CHANGED. A family member can never satisfy the holder guard (their
 * id is never an account_holder_id), so they are blocked from accepting — made observable
 * and tested in Slice 8.
 */
export async function acceptSuggestion(
  holderId: string,
  suggestionId: string,
): Promise<Record<string, unknown>> {
  // 1. The suggestion must exist.
  const suggestion = await getSuggestionById(suggestionId);
  if (!suggestion) {
    throwNotFound('SUGGESTION_NOT_FOUND', "That suggestion doesn't exist.");
  }

  // 2. It must be addressed to the caller (account holder only).
  if (suggestion.accountHolderId !== holderId) {
    throwForbidden('NOT_SUGGESTION_HOLDER', "That suggestion isn't addressed to you.");
  }

  // 3. It must still be pending (idempotent / race-safe).
  if (suggestion.status !== 'pending') {
    throwConflict('SUGGESTION_NOT_PENDING', 'That suggestion has already been reviewed.');
  }

  // 4. The holder must have a current plan, and it must be the one the suggestion targets.
  const plan = await getCurrentPlan(holderId);
  if (!plan) {
    throwNotFound('NO_PLAN', "You don't have a plan for this week yet.");
  }
  if (suggestion.weeklyPlanId !== plan.id) {
    throwConflict('PLAN_CHANGED', 'Your plan has changed since this suggestion was made.');
  }

  // 5. Re-match the replacement meal against the plan's existing store brand(s).
  const replacement = await findMealForMatching(suggestion.replacementMealId);
  if (!replacement) {
    throwBadRequest('INVALID_MEAL', "That replacement meal doesn't exist anymore.");
  }

  const oneStore = (plan.one_store_optimized as GroceryPlan | null) ?? null;
  const twoStore = (plan.two_store_optimized as GroceryPlan | null) ?? null;
  const reps = [oneStore, twoStore];

  const deals = await findActiveDealsByBrands(collectPlanBrandIds(reps));
  const dealsByBrand = buildDealsByBrand(deals);
  const fallbackPrice = getAverageDealPrice(deals);

  const profile = await findUserById(holderId);
  const budget = profile?.budget ?? null;

  const remainingMeals = await loadRemainingMeals(reps, suggestion.targetMealId);

  const newOneStore = oneStore
    ? swapMealInPlan(oneStore, suggestion.targetMealId, replacement, remainingMeals, dealsByBrand, fallbackPrice, budget)
    : null;
  const newTwoStore = twoStore
    ? swapMealInPlan(twoStore, suggestion.targetMealId, replacement, remainingMeals, dealsByBrand, fallbackPrice, budget)
    : null;

  if (!newOneStore) {
    // one_store_optimized is the canonical representation and is always present.
    throwNotFound('NO_PLAN', "You don't have a plan for this week yet.");
  }

  // 6. Persist the status flip + swapped plan JSONB atomically.
  const updated = await acceptSuggestionTransaction(
    suggestionId,
    plan.id as string,
    newOneStore,
    newTwoStore,
  );
  if (!updated) {
    // Lost a race — another accept/dismiss flipped it out of `pending` first.
    throwConflict('SUGGESTION_NOT_PENDING', 'That suggestion has already been reviewed.');
  }

  return updated;
}

/**
 * The account holder dismisses a family member's pending suggestion: the suggestion is
 * marked `dismissed` and the holder's plan is left **completely unchanged** — no swap, no
 * re-match, no shopping-list / savings change. The dismissed row drops out of every
 * pending-only read (the holder's GET /suggestions, the /landing count, and the suggester's
 * GET /family/plan markers). Returns the updated suggestion.
 *
 * Guards: 404 SUGGESTION_NOT_FOUND, 403 NOT_SUGGESTION_HOLDER, 409 SUGGESTION_NOT_PENDING.
 * Deliberately omits the NO_PLAN / PLAN_CHANGED guards `acceptSuggestion` needs — dismiss
 * never touches `weekly_plans`, so a stale-week suggestion can still be cleared out. A family
 * member can never satisfy the holder guard (their id is never an account_holder_id), so they
 * are blocked from dismissing — made observable and tested in Slice 8.
 */
export async function dismissSuggestion(
  holderId: string,
  suggestionId: string,
): Promise<Record<string, unknown>> {
  // 1. The suggestion must exist.
  const suggestion = await getSuggestionById(suggestionId);
  if (!suggestion) {
    throwNotFound('SUGGESTION_NOT_FOUND', "That suggestion doesn't exist.");
  }

  // 2. It must be addressed to the caller (account holder only).
  if (suggestion.accountHolderId !== holderId) {
    throwForbidden('NOT_SUGGESTION_HOLDER', "That suggestion isn't addressed to you.");
  }

  // 3. It must still be pending (idempotent / race-safe).
  if (suggestion.status !== 'pending') {
    throwConflict('SUGGESTION_NOT_PENDING', 'That suggestion has already been reviewed.');
  }

  // 4. Flip status to `dismissed`. No plan load, no swap — the plan stays byte-identical.
  const updated = await dismissSuggestionQuery(suggestionId);
  if (!updated) {
    // Lost a race — another accept/dismiss flipped it out of `pending` first.
    throwConflict('SUGGESTION_NOT_PENDING', 'That suggestion has already been reviewed.');
  }

  return updated;
}
