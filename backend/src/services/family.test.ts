import { describe, it, expect, vi, beforeEach } from 'vitest';

// ────────────────────────────────────────────────────────────
// Mock dependencies
// ────────────────────────────────────────────────────────────

vi.mock('../db/queries/family.js', () => ({
  getFamilyMemberLink: vi.fn(),
  createMealSuggestion: vi.fn(),
  getMySuggestionsForPlan: vi.fn(),
  getAllMySuggestionsForPlan: vi.fn(),
  getPendingSuggestionForMeal: vi.fn(),
  getSuggestionById: vi.fn(),
  acceptSuggestionTransaction: vi.fn(),
  updatePlanRepresentationsStandalone: vi.fn(),
  dismissSuggestion: vi.fn(),
}));

vi.mock('../db/queries/landing.js', () => ({
  getCurrentPlan: vi.fn(),
  getSavingsThisWeek: vi.fn(),
}));

vi.mock('../db/queries/meals.js', () => ({
  findMealById: vi.fn(),
  findMealForMatching: vi.fn(),
}));

vi.mock('../db/queries/optimizer.js', () => ({
  findActiveDealsByBrands: vi.fn(),
  findUserById: vi.fn(),
}));

// ────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────

import { suggestMeal, getFamilyPlan, getMySuggestions, acceptSuggestion, dismissSuggestion, editPlanMeal } from './family.js';
import * as familyQueries from '../db/queries/family.js';
import * as landingQueries from '../db/queries/landing.js';
import * as mealQueries from '../db/queries/meals.js';
import * as optimizerQueries from '../db/queries/optimizer.js';

const SAM_ID = '550e8400-e29b-41d4-a716-446655440000';
const JESSICA_ID = '11111111-1111-1111-1111-111111111111';
const PLAN_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_MEAL_ID = '33333333-3333-3333-3333-333333333333';
const REPLACEMENT_MEAL_ID = '44444444-4444-4444-4444-444444444444';

function planWithTargetIn(rep: 'one' | 'two'): Record<string, unknown> {
  const stopWithTarget = {
    storeBrandName: 'Walmart',
    storeLocationId: 'loc-1',
    meals: [
      { mealId: TARGET_MEAL_ID, name: 'Beef Taco Bowl', costPerServing: 1.5, totalCost: 6, savings: 2 },
    ],
    items: [],
    subtotal: 6,
  };
  const emptyStop = {
    storeBrandName: 'No Frills',
    storeLocationId: 'loc-2',
    meals: [
      { mealId: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'Other Meal', costPerServing: 1, totalCost: 4, savings: 1 },
    ],
    items: [],
    subtotal: 4,
  };
  return {
    id: PLAN_ID,
    token: 'tok',
    week_of: '2026-06-15',
    one_store_optimized: {
      stops: [rep === 'one' ? stopWithTarget : emptyStop],
      total: 6,
      budgetRemaining: 94,
      estimatedSavings: 2,
    },
    two_store_optimized:
      rep === 'two'
        ? { stops: [stopWithTarget], total: 6, budgetRemaining: 94, estimatedSavings: 2 }
        : null,
    watchlist_alerts: [],
    recipe_alerts: [],
    created_at: '2026-06-15T00:00:00.000Z',
  };
}

const CREATED_SUGGESTION = {
  id: 'sug-1',
  suggester_id: SAM_ID,
  account_holder_id: JESSICA_ID,
  weekly_plan_id: PLAN_ID,
  target_meal_id: TARGET_MEAL_ID,
  replacement_meal_id: REPLACEMENT_MEAL_ID,
  status: 'pending',
  created_at: '2026-06-17T00:00:00.000Z',
  replacement_meal_name: 'Creamy Mushroom Pasta',
  target_meal_name: 'Beef Taco Bowl',
};

describe('suggestMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: JESSICA_ID,
      holderDisplayName: 'Jessica M',
    });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('one'));
    vi.mocked(mealQueries.findMealById).mockResolvedValue({ id: REPLACEMENT_MEAL_ID, name: 'Creamy Mushroom Pasta' });
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(null);
    vi.mocked(familyQueries.createMealSuggestion).mockResolvedValue(CREATED_SUGGESTION);
  });

  it('creates a pending suggestion on the happy path', async () => {
    const result = await suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);

    expect(result).toEqual(CREATED_SUGGESTION);
    expect(familyQueries.createMealSuggestion).toHaveBeenCalledWith({
      suggesterId: SAM_ID,
      accountHolderId: JESSICA_ID,
      weeklyPlanId: PLAN_ID,
      targetMealId: TARGET_MEAL_ID,
      replacementMealId: REPLACEMENT_MEAL_ID,
    });
  });

  it('accepts a target meal that only appears in the two-store representation', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('two'));
    const result = await suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);
    expect(result).toEqual(CREATED_SUGGESTION);
  });

  it('throws NOT_A_FAMILY_MEMBER (403) when the caller is not linked to a holder', async () => {
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: null,
      holderDisplayName: null,
    });

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'NOT_A_FAMILY_MEMBER',
      status: 403,
    });
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('throws NO_PLAN (404) when the holder has no current plan', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(null);

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'NO_PLAN',
      status: 404,
    });
  });

  it('throws MEAL_NOT_IN_PLAN (400) when the target meal is not in the plan', async () => {
    await expect(
      suggestMeal(SAM_ID, 'ffffffff-ffff-ffff-ffff-ffffffffffff', REPLACEMENT_MEAL_ID),
    ).rejects.toMatchObject({ code: 'MEAL_NOT_IN_PLAN', status: 400 });
    expect(mealQueries.findMealById).not.toHaveBeenCalled();
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('throws INVALID_MEAL (400) when the replacement meal does not exist', async () => {
    vi.mocked(mealQueries.findMealById).mockResolvedValue(null);

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'INVALID_MEAL',
      status: 400,
    });
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('throws DUPLICATE_SUGGESTION (409) and skips the insert when a pending suggestion already exists', async () => {
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(CREATED_SUGGESTION);

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'DUPLICATE_SUGGESTION',
      status: 409,
    });
    expect(familyQueries.getPendingSuggestionForMeal).toHaveBeenCalledWith(SAM_ID, PLAN_ID, TARGET_MEAL_ID);
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
  });

  it('proceeds to createMealSuggestion when no pending suggestion exists for the meal', async () => {
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(null);

    await suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);

    expect(familyQueries.createMealSuggestion).toHaveBeenCalledTimes(1);
  });

  it('maps a unique-violation race (pg 23505) from the insert to 409 DUPLICATE_SUGGESTION', async () => {
    // Pre-check passes, but a concurrent submit wins the partial-unique index.
    vi.mocked(familyQueries.getPendingSuggestionForMeal).mockResolvedValue(null);
    vi.mocked(familyQueries.createMealSuggestion).mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );

    await expect(suggestMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'DUPLICATE_SUGGESTION',
      status: 409,
    });
  });
});

describe('getFamilyPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: JESSICA_ID,
      holderDisplayName: 'Jessica M',
    });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('one'));
    vi.mocked(landingQueries.getSavingsThisWeek).mockResolvedValue(23.34);
    vi.mocked(familyQueries.getMySuggestionsForPlan).mockResolvedValue([CREATED_SUGGESTION]);
  });

  it('includes the caller\'s pending suggestions for the holder plan', async () => {
    const result = await getFamilyPlan(SAM_ID);

    expect(result.holder_display_name).toBe('Jessica M');
    expect(result.holder_savings_this_week).toBe(23.34);
    expect(result.pending_suggestions).toEqual([CREATED_SUGGESTION]);
    expect(familyQueries.getMySuggestionsForPlan).toHaveBeenCalledWith(SAM_ID, PLAN_ID);
  });

  it('throws NOT_A_FAMILY_MEMBER (403) for a non-member', async () => {
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: null,
      holderDisplayName: null,
    });

    await expect(getFamilyPlan(JESSICA_ID)).rejects.toMatchObject({
      code: 'NOT_A_FAMILY_MEMBER',
      status: 403,
    });
  });
});

describe('getMySuggestions', () => {
  const ACCEPTED_SUGGESTION = { ...CREATED_SUGGESTION, id: 'sug-2', status: 'accepted' };
  const DISMISSED_SUGGESTION = { ...CREATED_SUGGESTION, id: 'sug-3', status: 'dismissed' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: JESSICA_ID,
      holderDisplayName: 'Jessica M',
    });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(planWithTargetIn('one'));
    vi.mocked(familyQueries.getAllMySuggestionsForPlan).mockResolvedValue([
      CREATED_SUGGESTION,
      ACCEPTED_SUGGESTION,
      DISMISSED_SUGGESTION,
    ]);
  });

  it('returns all of the caller\'s suggestions (every status) for the holder\'s current plan', async () => {
    const result = await getMySuggestions(SAM_ID);

    expect(result.suggestions).toEqual([CREATED_SUGGESTION, ACCEPTED_SUGGESTION, DISMISSED_SUGGESTION]);
    expect(result.suggestions.map((s) => (s as { status: string }).status)).toEqual([
      'pending',
      'accepted',
      'dismissed',
    ]);
    expect(familyQueries.getAllMySuggestionsForPlan).toHaveBeenCalledWith(SAM_ID, PLAN_ID);
    // The pending-only query that backs GET /family/plan markers must NOT be used here.
    expect(familyQueries.getMySuggestionsForPlan).not.toHaveBeenCalled();
  });

  it('throws NOT_A_FAMILY_MEMBER (403) when the caller is not linked to a holder', async () => {
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: null,
      holderDisplayName: null,
    });

    await expect(getMySuggestions(JESSICA_ID)).rejects.toMatchObject({
      code: 'NOT_A_FAMILY_MEMBER',
      status: 403,
    });
    expect(familyQueries.getAllMySuggestionsForPlan).not.toHaveBeenCalled();
  });

  it('throws NO_PLAN (404) when the holder has no current-week plan', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(null);

    await expect(getMySuggestions(SAM_ID)).rejects.toMatchObject({
      code: 'NO_PLAN',
      status: 404,
    });
    expect(familyQueries.getAllMySuggestionsForPlan).not.toHaveBeenCalled();
  });
});

describe('acceptSuggestion', () => {
  const SUGGESTION_ROW = {
    id: 'sug-1',
    suggesterId: SAM_ID,
    accountHolderId: JESSICA_ID,
    weeklyPlanId: PLAN_ID,
    targetMealId: TARGET_MEAL_ID,
    replacementMealId: REPLACEMENT_MEAL_ID,
    status: 'pending',
  };
  const ACCEPTED_SUGGESTION = { ...CREATED_SUGGESTION, status: 'accepted' };

  /** A full one-store plan whose stop holds the target meal and an on-sale line for it. */
  function fullOneStorePlan(): Record<string, unknown> {
    return {
      id: PLAN_ID,
      token: 'tok',
      week_of: '2026-06-15',
      one_store_optimized: {
        stops: [
          {
            storeBrandName: 'Walmart',
            storeLocationId: 'loc-1',
            storeAddress: '1 Rd',
            storeBrandId: 'brand-a',
            meals: [
              { mealId: TARGET_MEAL_ID, name: 'Beef Taco Bowl', costPerServing: 1.5, totalCost: 6, savings: 2 },
            ],
            items: [
              { name: 'Ground Beef', quantity: '1', salePrice: 6, regularPrice: 8, isOnSale: true, dealNote: null, forMeal: 'Beef Taco Bowl' },
            ],
            subtotal: 6,
          },
        ],
        total: 6,
        budgetRemaining: 94,
        estimatedSavings: 2,
      },
      two_store_optimized: null,
      watchlist_alerts: [],
      recipe_alerts: [],
      created_at: '2026-06-15T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getSuggestionById).mockResolvedValue({ ...SUGGESTION_ROW });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(fullOneStorePlan());
    vi.mocked(mealQueries.findMealForMatching).mockResolvedValue({
      id: REPLACEMENT_MEAL_ID,
      name: 'Creamy Mushroom Pasta',
      ingredientKeywords: ['mushroom', 'pasta'],
      servings: 4,
    });
    vi.mocked(optimizerQueries.findActiveDealsByBrands).mockResolvedValue([]);
    vi.mocked(optimizerQueries.findUserById).mockResolvedValue({
      id: JESSICA_ID,
      postalCode: 'L8P1A1',
      lat: null,
      lng: null,
      budget: 100,
      maxStores: 1,
      dietaryRestrictions: [],
    });
    vi.mocked(familyQueries.acceptSuggestionTransaction).mockResolvedValue(ACCEPTED_SUGGESTION);
  });

  it('swaps the target for the replacement and persists status=accepted', async () => {
    const result = await acceptSuggestion(JESSICA_ID, 'sug-1');

    expect(result).toEqual(ACCEPTED_SUGGESTION);
    expect(familyQueries.acceptSuggestionTransaction).toHaveBeenCalledTimes(1);

    const call = vi.mocked(familyQueries.acceptSuggestionTransaction).mock.calls[0]!;
    const [suggestionId, planId, newOneStore] = call;
    expect(suggestionId).toBe('sug-1');
    expect(planId).toBe(PLAN_ID);
    const mealIds = newOneStore.stops.flatMap((s) => s.meals.map((m) => m.mealId));
    expect(mealIds).not.toContain(TARGET_MEAL_ID);
    expect(mealIds).toContain(REPLACEMENT_MEAL_ID);
  });

  it('throws SUGGESTION_NOT_FOUND (404) for an unknown id', async () => {
    vi.mocked(familyQueries.getSuggestionById).mockResolvedValue(null);

    await expect(acceptSuggestion(JESSICA_ID, 'missing')).rejects.toMatchObject({
      code: 'SUGGESTION_NOT_FOUND',
      status: 404,
    });
    expect(familyQueries.acceptSuggestionTransaction).not.toHaveBeenCalled();
  });

  it('throws NOT_SUGGESTION_HOLDER (403) when the caller is not the addressed holder', async () => {
    // Sam (the family member who suggested it) is never an account holder.
    await expect(acceptSuggestion(SAM_ID, 'sug-1')).rejects.toMatchObject({
      code: 'NOT_SUGGESTION_HOLDER',
      status: 403,
    });
    expect(familyQueries.acceptSuggestionTransaction).not.toHaveBeenCalled();
  });

  it('throws SUGGESTION_NOT_PENDING (409) when already reviewed', async () => {
    vi.mocked(familyQueries.getSuggestionById).mockResolvedValue({ ...SUGGESTION_ROW, status: 'accepted' });

    await expect(acceptSuggestion(JESSICA_ID, 'sug-1')).rejects.toMatchObject({
      code: 'SUGGESTION_NOT_PENDING',
      status: 409,
    });
    expect(familyQueries.acceptSuggestionTransaction).not.toHaveBeenCalled();
  });

  it('throws NO_PLAN (404) when the holder has no current plan', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(null);

    await expect(acceptSuggestion(JESSICA_ID, 'sug-1')).rejects.toMatchObject({
      code: 'NO_PLAN',
      status: 404,
    });
  });

  it('throws PLAN_CHANGED (409) when the suggestion targets a stale plan', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue({
      ...fullOneStorePlan(),
      id: 'a-different-plan-id',
    });

    await expect(acceptSuggestion(JESSICA_ID, 'sug-1')).rejects.toMatchObject({
      code: 'PLAN_CHANGED',
      status: 409,
    });
    expect(familyQueries.acceptSuggestionTransaction).not.toHaveBeenCalled();
  });

  it('maps a lost accept race (transaction returns null) to SUGGESTION_NOT_PENDING (409)', async () => {
    vi.mocked(familyQueries.acceptSuggestionTransaction).mockResolvedValue(null);

    await expect(acceptSuggestion(JESSICA_ID, 'sug-1')).rejects.toMatchObject({
      code: 'SUGGESTION_NOT_PENDING',
      status: 409,
    });
  });
});

describe('dismissSuggestion', () => {
  const SUGGESTION_ROW = {
    id: 'sug-1',
    suggesterId: SAM_ID,
    accountHolderId: JESSICA_ID,
    weeklyPlanId: PLAN_ID,
    targetMealId: TARGET_MEAL_ID,
    replacementMealId: REPLACEMENT_MEAL_ID,
    status: 'pending',
  };
  const DISMISSED_SUGGESTION = { ...CREATED_SUGGESTION, status: 'dismissed' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familyQueries.getSuggestionById).mockResolvedValue({ ...SUGGESTION_ROW });
    vi.mocked(familyQueries.dismissSuggestion).mockResolvedValue(DISMISSED_SUGGESTION);
  });

  it('marks the suggestion dismissed without loading or mutating the plan', async () => {
    const result = await dismissSuggestion(JESSICA_ID, 'sug-1');

    expect(result).toEqual(DISMISSED_SUGGESTION);
    expect(familyQueries.dismissSuggestion).toHaveBeenCalledTimes(1);
    expect(familyQueries.dismissSuggestion).toHaveBeenCalledWith('sug-1');
    // The whole point of the slice: dismiss never touches the plan.
    expect(landingQueries.getCurrentPlan).not.toHaveBeenCalled();
    expect(mealQueries.findMealForMatching).not.toHaveBeenCalled();
    expect(familyQueries.acceptSuggestionTransaction).not.toHaveBeenCalled();
  });

  it('throws SUGGESTION_NOT_FOUND (404) for an unknown id', async () => {
    vi.mocked(familyQueries.getSuggestionById).mockResolvedValue(null);

    await expect(dismissSuggestion(JESSICA_ID, 'missing')).rejects.toMatchObject({
      code: 'SUGGESTION_NOT_FOUND',
      status: 404,
    });
    expect(familyQueries.dismissSuggestion).not.toHaveBeenCalled();
  });

  it('throws NOT_SUGGESTION_HOLDER (403) when the caller is not the addressed holder', async () => {
    // Sam (the family member who suggested it) is never an account holder.
    await expect(dismissSuggestion(SAM_ID, 'sug-1')).rejects.toMatchObject({
      code: 'NOT_SUGGESTION_HOLDER',
      status: 403,
    });
    expect(familyQueries.dismissSuggestion).not.toHaveBeenCalled();
  });

  it('throws SUGGESTION_NOT_PENDING (409) when already reviewed', async () => {
    vi.mocked(familyQueries.getSuggestionById).mockResolvedValue({ ...SUGGESTION_ROW, status: 'dismissed' });

    await expect(dismissSuggestion(JESSICA_ID, 'sug-1')).rejects.toMatchObject({
      code: 'SUGGESTION_NOT_PENDING',
      status: 409,
    });
    expect(familyQueries.dismissSuggestion).not.toHaveBeenCalled();
  });

  it('maps a lost dismiss race (query returns null) to SUGGESTION_NOT_PENDING (409)', async () => {
    vi.mocked(familyQueries.dismissSuggestion).mockResolvedValue(null);

    await expect(dismissSuggestion(JESSICA_ID, 'sug-1')).rejects.toMatchObject({
      code: 'SUGGESTION_NOT_PENDING',
      status: 409,
    });
  });
});

describe('editPlanMeal', () => {
  /** A full one-store plan whose stop holds the target meal and an on-sale line for it. */
  function fullOneStorePlan(): Record<string, unknown> {
    return {
      id: PLAN_ID,
      token: 'tok',
      week_of: '2026-06-15',
      one_store_optimized: {
        stops: [
          {
            storeBrandName: 'Walmart',
            storeLocationId: 'loc-1',
            storeAddress: '1 Rd',
            storeBrandId: 'brand-a',
            meals: [
              { mealId: TARGET_MEAL_ID, name: 'Beef Taco Bowl', costPerServing: 1.5, totalCost: 6, savings: 2 },
            ],
            items: [
              { name: 'Ground Beef', quantity: '1', salePrice: 6, regularPrice: 8, isOnSale: true, dealNote: null, forMeal: 'Beef Taco Bowl' },
            ],
            subtotal: 6,
          },
        ],
        total: 6,
        budgetRemaining: 94,
        estimatedSavings: 2,
      },
      two_store_optimized: null,
      watchlist_alerts: [],
      recipe_alerts: [],
      created_at: '2026-06-15T00:00:00.000Z',
    };
  }

  /** A plan where the target meal appears ONLY in the two-store representation. */
  function twoStoreOnlyPlan(): Record<string, unknown> {
    const targetStop = {
      storeBrandName: 'Walmart',
      storeLocationId: 'loc-1',
      storeAddress: '1 Rd',
      storeBrandId: 'brand-a',
      meals: [
        { mealId: TARGET_MEAL_ID, name: 'Beef Taco Bowl', costPerServing: 1.5, totalCost: 6, savings: 2 },
      ],
      items: [],
      subtotal: 6,
    };
    const otherStop = {
      storeBrandName: 'No Frills',
      storeLocationId: 'loc-2',
      storeAddress: '2 Rd',
      storeBrandId: 'brand-b',
      meals: [
        { mealId: 'aaaaaaaa-0000-0000-0000-000000000000', name: 'Other Meal', costPerServing: 1, totalCost: 4, savings: 1 },
      ],
      items: [],
      subtotal: 4,
    };
    return {
      id: PLAN_ID,
      token: 'tok',
      week_of: '2026-06-15',
      // one-store does NOT contain the target (only 'Other Meal')
      one_store_optimized: { stops: [otherStop], total: 4, budgetRemaining: 96, estimatedSavings: 1 },
      // two-store DOES contain the target
      two_store_optimized: { stops: [targetStop], total: 6, budgetRemaining: 94, estimatedSavings: 2 },
      watchlist_alerts: [],
      recipe_alerts: [],
      created_at: '2026-06-15T00:00:00.000Z',
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Jessica is the account holder — accountHolderId === null means "not a family member".
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: null,
      holderDisplayName: null,
    });
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(fullOneStorePlan());
    vi.mocked(mealQueries.findMealForMatching).mockResolvedValue({
      id: REPLACEMENT_MEAL_ID,
      name: 'Creamy Mushroom Pasta',
      ingredientKeywords: ['mushroom', 'pasta'],
      servings: 4,
    });
    vi.mocked(optimizerQueries.findActiveDealsByBrands).mockResolvedValue([]);
    vi.mocked(optimizerQueries.findUserById).mockResolvedValue({
      id: JESSICA_ID,
      postalCode: 'L8P1A1',
      lat: null,
      lng: null,
      budget: 100,
      maxStores: 1,
      dietaryRestrictions: [],
    });
    vi.mocked(familyQueries.updatePlanRepresentationsStandalone).mockResolvedValue(undefined);
  });

  it('swaps the target for the replacement, persists via updatePlanRepresentationsStandalone, and writes no suggestion', async () => {
    const result = await editPlanMeal(JESSICA_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);

    // Persisted exactly once, with the swapped plan JSONB.
    expect(familyQueries.updatePlanRepresentationsStandalone).toHaveBeenCalledTimes(1);
    const [planId, newOneStore] = vi.mocked(familyQueries.updatePlanRepresentationsStandalone).mock.calls[0]!;
    expect(planId).toBe(PLAN_ID);
    const persistedIds = newOneStore.stops.flatMap((s) => s.meals.map((m) => m.mealId));
    expect(persistedIds).not.toContain(TARGET_MEAL_ID);
    expect(persistedIds).toContain(REPLACEMENT_MEAL_ID);

    // Returned reps reflect the swap.
    const returnedIds = result.one_store_optimized.stops.flatMap((s) => s.meals.map((m) => m.mealId));
    expect(returnedIds).toContain(REPLACEMENT_MEAL_ID);
    expect(returnedIds).not.toContain(TARGET_MEAL_ID);

    // The defining difference from acceptSuggestion: NO suggestion row is created or touched.
    expect(familyQueries.acceptSuggestionTransaction).not.toHaveBeenCalled();
    expect(familyQueries.createMealSuggestion).not.toHaveBeenCalled();
    expect(familyQueries.getSuggestionById).not.toHaveBeenCalled();
  });

  it('throws NOT_ACCOUNT_HOLDER (403) when the caller is a family member, and mutates nothing', async () => {
    // Sam is linked to Jessica → his account_holder_id is non-null → he is a family member.
    vi.mocked(familyQueries.getFamilyMemberLink).mockResolvedValue({
      accountHolderId: JESSICA_ID,
      holderDisplayName: 'Jessica M',
    });

    await expect(editPlanMeal(SAM_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'NOT_ACCOUNT_HOLDER',
      status: 403,
    });
    expect(familyQueries.updatePlanRepresentationsStandalone).not.toHaveBeenCalled();
    // Blocked before any plan is loaded.
    expect(landingQueries.getCurrentPlan).not.toHaveBeenCalled();
  });

  it('throws NO_PLAN (404) when the holder has no current plan', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(null);

    await expect(editPlanMeal(JESSICA_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'NO_PLAN',
      status: 404,
    });
    expect(familyQueries.updatePlanRepresentationsStandalone).not.toHaveBeenCalled();
  });

  it('throws MEAL_NOT_IN_PLAN (400) when the target meal is not in the plan', async () => {
    await expect(
      editPlanMeal(JESSICA_ID, 'ffffffff-ffff-ffff-ffff-ffffffffffff', REPLACEMENT_MEAL_ID),
    ).rejects.toMatchObject({ code: 'MEAL_NOT_IN_PLAN', status: 400 });
    expect(mealQueries.findMealForMatching).not.toHaveBeenCalled();
    expect(familyQueries.updatePlanRepresentationsStandalone).not.toHaveBeenCalled();
  });

  it('throws INVALID_MEAL (400) when the replacement meal does not exist', async () => {
    vi.mocked(mealQueries.findMealForMatching).mockResolvedValue(null);

    await expect(editPlanMeal(JESSICA_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID)).rejects.toMatchObject({
      code: 'INVALID_MEAL',
      status: 400,
    });
    expect(familyQueries.updatePlanRepresentationsStandalone).not.toHaveBeenCalled();
  });

  it('swaps a target meal that only appears in the two-store representation', async () => {
    vi.mocked(landingQueries.getCurrentPlan).mockResolvedValue(twoStoreOnlyPlan());

    const result = await editPlanMeal(JESSICA_ID, TARGET_MEAL_ID, REPLACEMENT_MEAL_ID);

    expect(familyQueries.updatePlanRepresentationsStandalone).toHaveBeenCalledTimes(1);
    // The two-store rep is where the swap lands; one-store is returned unchanged (no target).
    const twoIds = result.two_store_optimized!.stops.flatMap((s) => s.meals.map((m) => m.mealId));
    expect(twoIds).toContain(REPLACEMENT_MEAL_ID);
    expect(twoIds).not.toContain(TARGET_MEAL_ID);
    const oneIds = result.one_store_optimized.stops.flatMap((s) => s.meals.map((m) => m.mealId));
    expect(oneIds).not.toContain(TARGET_MEAL_ID);
    expect(oneIds).not.toContain(REPLACEMENT_MEAL_ID);
  });
});
